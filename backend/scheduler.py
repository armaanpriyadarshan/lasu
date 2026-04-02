import asyncio
import logging
from datetime import datetime, time

from db import get_due_jobs, mark_job_ran, save_agent_message
from agent import run_heartbeat

logger = logging.getLogger("scheduler")

POLL_INTERVAL = 30


def _in_active_hours(job: dict) -> bool:
    start = job.get("active_hours_start")
    end = job.get("active_hours_end")
    if not start or not end:
        return True

    now = datetime.now().time()
    start_time = time.fromisoformat(start)
    end_time = time.fromisoformat(end)

    if start_time <= end_time:
        return start_time <= now <= end_time
    else:
        return now >= start_time or now <= end_time


async def _process_job(job: dict):
    agent_id = job["agent_id"]
    job_id = job["id"]
    schedule_ms = job["schedule_ms"]

    if not _in_active_hours(job):
        await mark_job_ran(job_id, schedule_ms)
        return

    try:
        if job["job_type"] == "heartbeat":
            result = await run_heartbeat(agent_id)
            if result:
                agent_data = job.get("agents", {})
                user_id = agent_data.get("user_id")
                if user_id:
                    await save_agent_message(agent_id, user_id, "assistant", result)
                    logger.info(f"Heartbeat for agent {agent_id}: message saved")
            else:
                logger.debug(f"Heartbeat for agent {agent_id}: suppressed")
    except Exception as e:
        logger.error(f"Heartbeat error for agent {agent_id}: {e}")
    finally:
        await mark_job_ran(job_id, schedule_ms)


async def scheduler_loop():
    logger.info("Scheduler started")
    while True:
        try:
            due_jobs = await get_due_jobs()
            for job in due_jobs:
                await _process_job(job)
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        await asyncio.sleep(POLL_INTERVAL)
