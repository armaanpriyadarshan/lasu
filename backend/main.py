import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_or_create_session, get_sessions, close_session,
    get_agent_memories, upsert_memory, delete_memory,
    get_agent_permissions, grant_permission, revoke_permission,
    get_pending_requests, resolve_permission_request,
    create_job, get_jobs, get_job, update_job, delete_job,
    get_oauth_token,
)
from google_auth import get_auth_url, exchange_code
from agent import run_agent, run_agent_chat, generate_system_prompt
from memory import extract_memories
from models import MessageRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest, GrantPermissionRequest, CreateJobRequest, UpdateJobRequest
from scheduler import scheduler_loop
from auth import get_current_user


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "sudo running"}


@app.get("/dashboard/{user_id}")
async def dashboard(user_id: str, _user: str = Depends(get_current_user)):
    from db import get_dashboard_stats
    stats = await get_dashboard_stats(user_id)
    return stats


@app.get("/messages/{user_id}")
async def messages(user_id: str, _user: str = Depends(get_current_user)):
    rows = await get_recent_messages(user_id)
    return {"messages": rows}


@app.post("/message")
async def handle_message(req: MessageRequest, _user: str = Depends(get_current_user)):
    user = await get_or_create_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await save_message(req.user_id, "user", req.content)
    reply = await run_agent(req.user_id, req.content)
    await save_message(req.user_id, "assistant", reply)

    return {"reply": reply}


# --- Agent endpoints ---

@app.post("/agents")
async def create_agent_endpoint(req: CreateAgentRequest, _user: str = Depends(get_current_user)):
    await get_or_create_user(req.user_id)
    system_prompt = await generate_system_prompt(req.description)
    try:
        agent = await create_agent(req.user_id, req.name, req.description, system_prompt, req.emoji, req.tone)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return agent


@app.get("/agents")
async def list_agents(user_id: str, _user: str = Depends(get_current_user)):
    agents = await get_agents(user_id)
    return {"agents": agents}


@app.get("/agents/{agent_id}")
async def get_agent_endpoint(agent_id: str, _user: str = Depends(get_current_user)):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch("/agents/{agent_id}")
async def update_agent_endpoint(agent_id: str, req: UpdateAgentRequest, _user: str = Depends(get_current_user)):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    agent = await update_agent(agent_id, updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.delete("/agents/{agent_id}")
async def delete_agent_endpoint(agent_id: str, _user: str = Depends(get_current_user)):
    success = await delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"ok": True}


@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest, _user: str = Depends(get_current_user)):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    session = await get_or_create_session(agent_id)
    session_id = session["id"]

    await save_agent_message(agent_id, req.user_id, "user", req.message, session_id=session_id)

    result = await run_agent_chat(agent_id, req.message, user_id=req.user_id)

    reply = result["reply"]
    tool_calls = result.get("tool_calls", [])
    perm_requests = result.get("permission_requests", [])

    await save_agent_message(agent_id, req.user_id, "assistant", reply, session_id=session_id)

    # Extract and save memories (non-critical, don't fail the response)
    try:
        existing = await get_agent_memories(agent_id)
        memories = await extract_memories(req.message, reply, existing)
        for mem in memories:
            await upsert_memory(agent_id, mem["key"], mem["value"])
    except Exception:
        pass

    return {
        "reply": reply,
        "tool_calls": tool_calls,
        "permission_requests": perm_requests,
    }


@app.post("/agents/{agent_id}/chat/stream")
async def chat_with_agent_stream(agent_id: str, req: ChatRequest, _user: str = Depends(get_current_user)):
    from fastapi.responses import StreamingResponse
    from agent import stream_agent_reply

    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    session = await get_or_create_session(agent_id)
    session_id = session["id"]

    await save_agent_message(agent_id, req.user_id, "user", req.message, session_id=session_id)

    async def event_stream():
        full_reply = ""
        tool_calls = []
        # Send session info first
        yield f"data: {json.dumps({'type': 'session', 'data': {'id': session_id}})}\n\n"
        async for event in stream_agent_reply(agent_id, req.message, user_id=req.user_id):
            if event["type"] == "tool_calls":
                tool_calls = event["data"]
                yield f"data: {json.dumps(event)}\n\n"
            elif event["type"] == "token":
                full_reply += event["data"]
                yield f"data: {json.dumps(event)}\n\n"
            elif event["type"] == "done":
                yield f"data: {json.dumps(event)}\n\n"

        await save_agent_message(agent_id, req.user_id, "assistant", full_reply, session_id=session_id)

        try:
            existing = await get_agent_memories(agent_id)
            memories = await extract_memories(req.message, full_reply, existing)
            for mem in memories:
                await upsert_memory(agent_id, mem["key"], mem["value"])
        except Exception:
            pass

    import json
    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/agents/{agent_id}/messages")
async def get_agent_messages_endpoint(agent_id: str, limit: int = 50, session_id: str = None, _user: str = Depends(get_current_user)):
    messages = await get_agent_messages(agent_id, limit, session_id=session_id)
    return {"messages": messages}


@app.get("/agents/{agent_id}/sessions")
async def list_sessions(agent_id: str, _user: str = Depends(get_current_user)):
    sessions = await get_sessions(agent_id)
    return {"sessions": sessions}


@app.post("/agents/{agent_id}/sessions")
async def new_session(agent_id: str, _user: str = Depends(get_current_user)):
    # Close current active session
    sessions = await get_sessions(agent_id)
    for s in sessions:
        if s["is_active"]:
            await close_session(s["id"])
    session = await get_or_create_session(agent_id)
    return session


@app.post("/agents/{agent_id}/sessions/{session_id}/close")
async def close_session_endpoint(agent_id: str, session_id: str, _user: str = Depends(get_current_user)):
    await close_session(session_id)
    return {"ok": True}


# --- Memory endpoints ---

@app.get("/agents/{agent_id}/memory")
async def get_memories(agent_id: str, _user: str = Depends(get_current_user)):
    memories = await get_agent_memories(agent_id)
    return {"memories": memories}


@app.delete("/agents/{agent_id}/memory/{memory_id}")
async def delete_memory_endpoint(agent_id: str, memory_id: str, _user: str = Depends(get_current_user)):
    success = await delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}


# --- Permission endpoints ---

@app.get("/agents/{agent_id}/permissions")
async def get_permissions(agent_id: str, _user: str = Depends(get_current_user)):
    permissions = await get_agent_permissions(agent_id)
    return {"permissions": permissions}


@app.get("/agents/{agent_id}/permissions/requests")
async def get_permission_requests(agent_id: str, _user: str = Depends(get_current_user)):
    requests = await get_pending_requests(agent_id)
    return {"requests": requests}


@app.post("/agents/{agent_id}/permissions/requests/{request_id}/grant")
async def grant_permission_endpoint(agent_id: str, request_id: str, req: GrantPermissionRequest, _user: str = Depends(get_current_user)):
    if req.grant_type not in ("one_time", "permanent"):
        raise HTTPException(status_code=400, detail="grant_type must be 'one_time' or 'permanent'")

    resolved = await resolve_permission_request(request_id, "approved", req.grant_type)
    if not resolved:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")

    perm = await grant_permission(agent_id, resolved["permission"], req.grant_type)
    return perm


@app.post("/agents/{agent_id}/permissions/requests/{request_id}/deny")
async def deny_permission_endpoint(agent_id: str, request_id: str, _user: str = Depends(get_current_user)):
    resolved = await resolve_permission_request(request_id, "denied")
    if not resolved:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")
    return {"ok": True}


@app.post("/agents/{agent_id}/permissions/grant")
async def direct_grant_permission(agent_id: str, req: GrantPermissionRequest, _user: str = Depends(get_current_user)):
    perm = await grant_permission(agent_id, req.permission, req.grant_type)
    return perm


@app.post("/agents/{agent_id}/permissions/{permission_id}/revoke")
async def revoke_permission_endpoint(agent_id: str, permission_id: str, _user: str = Depends(get_current_user)):
    success = await revoke_permission(permission_id)
    if not success:
        raise HTTPException(status_code=404, detail="Permission not found or already revoked")
    return {"ok": True}


# --- Job endpoints ---

@app.post("/agents/{agent_id}/jobs")
async def create_job_endpoint(agent_id: str, req: CreateJobRequest, _user: str = Depends(get_current_user)):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    job = await create_job(
        agent_id,
        schedule_ms=req.schedule_ms,
        active_hours_start=req.active_hours_start,
        active_hours_end=req.active_hours_end,
    )
    return job


@app.get("/agents/{agent_id}/jobs")
async def list_jobs(agent_id: str, _user: str = Depends(get_current_user)):
    jobs = await get_jobs(agent_id)
    return {"jobs": jobs}


@app.patch("/agents/{agent_id}/jobs/{job_id}")
async def update_job_endpoint(agent_id: str, job_id: str, req: UpdateJobRequest, _user: str = Depends(get_current_user)):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    job = await update_job(job_id, updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.delete("/agents/{agent_id}/jobs/{job_id}")
async def delete_job_endpoint(agent_id: str, job_id: str, _user: str = Depends(get_current_user)):
    success = await delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


# --- Google OAuth endpoints ---

@app.get("/auth/google/url")
async def google_auth_url(user_id: str):
    url = get_auth_url(user_id)
    return {"url": url}


@app.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    from fastapi.responses import HTMLResponse
    user_id = state
    await exchange_code(code, user_id)
    return HTMLResponse("""<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>sudo — connected</title>
<style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#F5F0E3;font-family:serif;flex-direction:column;gap:12px}
h1{font-size:24px;color:#1A1A18;font-weight:400}p{color:#6B6860;font-size:14px}</style>
</head><body>
<h1>Google account connected</h1>
<p>You can close this tab and return to sudo.</p>
<script>setTimeout(()=>window.close(),2000)</script>
</body></html>""")


@app.get("/auth/google/status")
async def google_status(user_id: str):
    token = await get_oauth_token(user_id, "google")
    return {"connected": token is not None}
