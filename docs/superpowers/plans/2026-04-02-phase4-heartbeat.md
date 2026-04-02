# Phase 4: Heartbeat & Scheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents wake up autonomously on configurable intervals, check for pending items, and either act (creating a message in chat) or stay silent (smart suppression). Users can configure heartbeat on/off, interval, and active hours from the chat screen.

**Architecture:** New `agent_jobs` table stores heartbeat configuration per agent. A background scheduler (`asyncio` task running inside the FastAPI app) polls for due jobs every 30 seconds. When a heartbeat fires, it runs a lightweight "check-in" prompt using the agent's memories and recent messages. If the agent has something to report, it saves a message to the chat. If not, it stays silent. The frontend gets a heartbeat config section in the chat header.

**Tech Stack:** Supabase (PostgreSQL), FastAPI, asyncio, OpenAI API, Expo Router, React Native, TypeScript

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/db.py` | Add job CRUD functions |
| `backend/scheduler.py` | **New** — background scheduler that polls for due jobs and runs heartbeats |
| `backend/agent.py` | Add `run_heartbeat` function (lightweight check-in prompt) |
| `backend/main.py` | Add job endpoints, start/stop scheduler on app lifecycle |
| `backend/models.py` | Add job request models |
| `src/lib/api.ts` | Add job types and API functions |
| `src/app/(app)/chat/[agentId].tsx` | Add heartbeat config toggle in header |

---

### Task 1: Database Migration — Create `agent_jobs` table

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Create `agent_jobs` table via Supabase MCP**

Run this SQL migration against project `imvbbxblyegwmkfdzxmb`:

```sql
CREATE TABLE public.agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'heartbeat',
  schedule_ms BIGINT NOT NULL DEFAULT 1800000,
  active_hours_start TIME,
  active_hours_end TIME,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_jobs_agent_id ON public.agent_jobs(agent_id);
CREATE INDEX idx_agent_jobs_next_run ON public.agent_jobs(next_run) WHERE enabled = true;

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;
```

`schedule_ms` defaults to 1800000 (30 minutes). Using ms instead of text for simpler comparison logic.

- [ ] **Step 2: Verify table exists**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_jobs' ORDER BY ordinal_position;`

Expected: 11 columns.

---

### Task 2: Backend — Job database operations

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add job functions to the end of `db.py`**

```python
# ── Job functions ──

async def create_job(agent_id: str, job_type: str = "heartbeat", schedule_ms: int = 1800000,
                     active_hours_start: str = None, active_hours_end: str = None) -> dict:
    data = {
        "agent_id": agent_id,
        "job_type": job_type,
        "schedule_ms": schedule_ms,
        "next_run": "now()",
    }
    if active_hours_start:
        data["active_hours_start"] = active_hours_start
    if active_hours_end:
        data["active_hours_end"] = active_hours_end
    res = supabase.table("agent_jobs").insert(data).execute()
    return res.data[0] if res.data else None


async def get_jobs(agent_id: str) -> list:
    res = (
        supabase.table("agent_jobs")
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def get_job(job_id: str) -> dict | None:
    res = supabase.table("agent_jobs").select("*").eq("id", job_id).execute()
    return res.data[0] if res.data else None


async def update_job(job_id: str, updates: dict) -> dict | None:
    res = supabase.table("agent_jobs").update(updates).eq("id", job_id).execute()
    return res.data[0] if res.data else None


async def delete_job(job_id: str) -> bool:
    res = supabase.table("agent_jobs").delete().eq("id", job_id).execute()
    return len(res.data) > 0


async def get_due_jobs() -> list:
    """Get all enabled jobs where next_run <= now."""
    res = (
        supabase.table("agent_jobs")
        .select("*, agents!inner(id, user_id, name, system_prompt, model, is_active)")
        .eq("enabled", True)
        .lte("next_run", "now()")
        .execute()
    )
    # Filter to only active agents
    return [j for j in res.data if j.get("agents", {}).get("is_active", False)]


async def mark_job_ran(job_id: str, schedule_ms: int):
    """Update last_run to now and calculate next_run."""
    supabase.rpc("mark_job_ran", {"job_id_param": job_id, "schedule_ms_param": schedule_ms}).execute()
```

- [ ] **Step 2: Create the `mark_job_ran` database function via Supabase MCP**

This needs to be a SQL function so `next_run` is calculated atomically:

```sql
CREATE OR REPLACE FUNCTION mark_job_ran(job_id_param UUID, schedule_ms_param BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_jobs
  SET last_run = now(),
      next_run = now() + (schedule_ms_param || ' milliseconds')::interval
  WHERE id = job_id_param;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 3: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from db import create_job, get_jobs, get_job, update_job, delete_job, get_due_jobs, mark_job_ran; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/db.py
git commit -m "feat: add job CRUD and scheduling database operations"
```

---

### Task 3: Backend — Heartbeat runner in agent.py

**Files:**
- Modify: `backend/agent.py`

- [ ] **Step 1: Add `run_heartbeat` function to the end of `agent.py`**

```python
HEARTBEAT_PROMPT = """You are checking in on behalf of this user. Review what you know about them and any recent context.

If you have something useful to proactively share — a reminder, a follow-up, a suggestion, or an observation — respond with it concisely.

If there's nothing worth mentioning right now, respond with exactly: HEARTBEAT_OK

Do not make up tasks or fabricate urgency. Only speak if you have something genuinely useful to say."""


async def run_heartbeat(agent_id: str) -> str | None:
    """Run a heartbeat check for an agent. Returns a message if the agent has something to say, None if suppressed."""
    agent = await get_agent(agent_id)
    if not agent:
        return None

    system_prompt = agent.get("system_prompt") or DEFAULT_SYSTEM_PROMPT

    # Load memories for context
    memories = await get_agent_memories(agent_id)
    if memories:
        memory_text = "\n".join(f"- {m['key']}: {m['value']}" for m in memories)
        system_prompt += f"\n\nThings you remember about this user:\n{memory_text}"

    # Light context: only last 5 messages (not full 20)
    history = await get_agent_messages(agent_id, limit=5)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": HEARTBEAT_PROMPT})

    response = _get_client().chat.completions.create(
        model=agent.get("model", "gpt-4o-mini"),  # Use cheaper model for heartbeats
        max_completion_tokens=300,
        messages=messages,
    )

    reply = response.choices[0].message.content.strip()

    # Smart suppression
    if reply == "HEARTBEAT_OK" or not reply:
        return None

    return reply
```

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from agent import run_heartbeat; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add heartbeat runner with smart suppression"
```

---

### Task 4: Backend — Scheduler service

**Files:**
- Create: `backend/scheduler.py`

- [ ] **Step 1: Create `scheduler.py`**

```python
import asyncio
import logging
from datetime import datetime, time

from db import get_due_jobs, mark_job_ran, save_agent_message
from agent import run_heartbeat

logger = logging.getLogger("scheduler")

POLL_INTERVAL = 30  # seconds


def _in_active_hours(job: dict) -> bool:
    """Check if the current time is within the job's active hours."""
    start = job.get("active_hours_start")
    end = job.get("active_hours_end")
    if not start or not end:
        return True  # No active hours constraint

    now = datetime.now().time()
    start_time = time.fromisoformat(start)
    end_time = time.fromisoformat(end)

    if start_time <= end_time:
        return start_time <= now <= end_time
    else:
        # Wraps midnight (e.g., 22:00 - 06:00)
        return now >= start_time or now <= end_time


async def _process_job(job: dict):
    """Process a single due job."""
    agent_id = job["agent_id"]
    job_id = job["id"]
    schedule_ms = job["schedule_ms"]

    if not _in_active_hours(job):
        # Outside active hours — reschedule without running
        await mark_job_ran(job_id, schedule_ms)
        return

    try:
        if job["job_type"] == "heartbeat":
            result = await run_heartbeat(agent_id)
            if result:
                # Agent has something to say — save as a message
                agent_data = job.get("agents", {})
                user_id = agent_data.get("user_id")
                if user_id:
                    await save_agent_message(agent_id, user_id, "assistant", result)
                    logger.info(f"Heartbeat for agent {agent_id}: message saved")
            else:
                logger.debug(f"Heartbeat for agent {agent_id}: suppressed (nothing to report)")
    except Exception as e:
        logger.error(f"Heartbeat error for agent {agent_id}: {e}")
    finally:
        # Always reschedule
        await mark_job_ran(job_id, schedule_ms)


async def scheduler_loop():
    """Main scheduler loop — polls for due jobs and processes them."""
    logger.info("Scheduler started")
    while True:
        try:
            due_jobs = await get_due_jobs()
            for job in due_jobs:
                await _process_job(job)
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        await asyncio.sleep(POLL_INTERVAL)
```

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from scheduler import scheduler_loop; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/scheduler.py
git commit -m "feat: add background scheduler service for heartbeat jobs"
```

---

### Task 5: Backend — Job endpoints and app lifecycle

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add job models to models.py**

Add to the end of `backend/models.py`:

```python
class CreateJobRequest(BaseModel):
    schedule_ms: int = 1800000  # Default 30 minutes
    active_hours_start: Optional[str] = None  # "08:00"
    active_hours_end: Optional[str] = None    # "22:00"


class UpdateJobRequest(BaseModel):
    schedule_ms: Optional[int] = None
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None
    enabled: Optional[bool] = None
```

- [ ] **Step 2: Update imports in main.py**

Update db import to add job functions:

```python
from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_agent_memories, upsert_memory, delete_memory,
    get_agent_permissions, grant_permission, revoke_permission,
    get_pending_requests, resolve_permission_request,
    create_job, get_jobs, get_job, update_job, delete_job,
)
```

Update models import:

```python
from models import MessageRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest, GrantPermissionRequest, CreateJobRequest, UpdateJobRequest
```

Add scheduler import at the top, after the other imports:

```python
import asyncio
from contextlib import asynccontextmanager
from scheduler import scheduler_loop
```

- [ ] **Step 3: Add app lifespan for scheduler**

Replace the `app = FastAPI()` line with:

```python
@asynccontextmanager
async def lifespan(app):
    # Start scheduler on startup
    task = asyncio.create_task(scheduler_loop())
    yield
    # Cancel scheduler on shutdown
    task.cancel()

app = FastAPI(lifespan=lifespan)
```

- [ ] **Step 4: Add job endpoints at the end of main.py**

```python
# --- Job endpoints ---

@app.post("/agents/{agent_id}/jobs")
async def create_job_endpoint(agent_id: str, req: CreateJobRequest):
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
async def list_jobs(agent_id: str):
    jobs = await get_jobs(agent_id)
    return {"jobs": jobs}


@app.patch("/agents/{agent_id}/jobs/{job_id}")
async def update_job_endpoint(agent_id: str, job_id: str, req: UpdateJobRequest):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    job = await update_job(job_id, updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.delete("/agents/{agent_id}/jobs/{job_id}")
async def delete_job_endpoint(agent_id: str, job_id: str):
    success = await delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}
```

- [ ] **Step 5: Verify server imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add job endpoints and scheduler lifecycle management"
```

---

### Task 6: Frontend — Job API client

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add job types and API functions to the end of `api.ts`**

```typescript
// ── Job types ──

export type AgentJob = {
  id: string
  agent_id: string
  job_type: string
  schedule_ms: number
  active_hours_start: string | null
  active_hours_end: string | null
  last_run: string | null
  next_run: string | null
  enabled: boolean
  config: Record<string, unknown>
  created_at: string
}

// ── Job API ──

export async function createJob(agentId: string, scheduleMins: number = 30) {
  const res = await fetch(`${API_URL}/agents/${agentId}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedule_ms: scheduleMins * 60 * 1000 }),
  })
  if (!res.ok) throw new Error('Failed to create job')
  return res.json() as Promise<AgentJob>
}

export async function getJobs(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/jobs`)
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json() as Promise<{ jobs: AgentJob[] }>
}

export async function updateJob(agentId: string, jobId: string, updates: { schedule_ms?: number; enabled?: boolean; active_hours_start?: string; active_hours_end?: string }) {
  const res = await fetch(`${API_URL}/agents/${agentId}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update job')
  return res.json() as Promise<AgentJob>
}

export async function deleteJob(agentId: string, jobId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/jobs/${jobId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete job')
  return res.json() as Promise<{ ok: boolean }>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add job API client functions"
```

---

### Task 7: Frontend — Heartbeat config in chat screen

**Files:**
- Modify: `src/app/(app)/chat/[agentId].tsx`

- [ ] **Step 1: Update api imports**

Add job functions to the existing import from `@/lib/api`:

```typescript
import {
  getAgent, getAgentMessages, chatWithAgent,
  getAgentMemories, deleteAgentMemory,
  getPendingRequests, grantPermissionRequest, denyPermissionRequest,
  getAgentPermissions, revokePermission,
  getJobs, createJob, updateJob, deleteJob,
  type Agent, type AgentMessage, type AgentMemory,
  type PermissionRequest, type AgentPermission, type AgentJob,
} from '@/lib/api'
```

- [ ] **Step 2: Add job state**

After the `showPermissions` state, add:

```typescript
const [heartbeat, setHeartbeat] = useState<AgentJob | null>(null)
```

- [ ] **Step 3: Load heartbeat in useFocusEffect**

Update `Promise.all` to also fetch jobs:

```typescript
Promise.all([
  getAgent(agentId),
  getAgentMessages(agentId),
  getAgentMemories(agentId),
  getPendingRequests(agentId),
  getAgentPermissions(agentId),
  getJobs(agentId),
])
  .then(([agentData, { messages }, { memories }, { requests }, { permissions }, { jobs }]) => {
    setAgent(agentData)
    setMessages(messages)
    setMemories(memories)
    setPermRequests(requests)
    setPermissions(permissions)
    setHeartbeat(jobs.find((j: AgentJob) => j.job_type === 'heartbeat') || null)
  })
  .catch(() => router.back())
  .finally(() => setLoading(false))
```

- [ ] **Step 4: Add heartbeat toggle handler**

After the permission handlers, add:

```typescript
const handleToggleHeartbeat = async () => {
  if (!agentId) return
  try {
    if (heartbeat) {
      if (heartbeat.enabled) {
        const updated = await updateJob(agentId, heartbeat.id, { enabled: false })
        setHeartbeat(updated)
      } else {
        const updated = await updateJob(agentId, heartbeat.id, { enabled: true })
        setHeartbeat(updated)
      }
    } else {
      const job = await createJob(agentId, 30)
      setHeartbeat(job)
    }
  } catch {}
}
```

- [ ] **Step 5: Add heartbeat toggle to header**

In the `headerRight` View, add a heartbeat toggle before the Perms toggle:

```tsx
<View style={styles.headerRight}>
  <Pressable onPress={handleToggleHeartbeat}>
    <ThemedText style={{ color: heartbeat?.enabled ? C.connectedText : C.pencil, fontSize: 11 }}>
      {heartbeat?.enabled ? 'Live' : 'Idle'}
    </ThemedText>
  </Pressable>
  <Pressable onPress={() => { setShowPermissions(!showPermissions); setShowMemory(false) }}>
    <ThemedText style={{ color: showPermissions ? C.tide : C.pencil, fontSize: 11 }}>
      {permissions.length > 0 ? `Perms (${permissions.length})` : 'Perms'}
    </ThemedText>
  </Pressable>
  <Pressable onPress={() => { setShowMemory(!showMemory); setShowPermissions(false) }}>
    <ThemedText style={{ color: showMemory ? C.tide : C.pencil, fontSize: 11 }}>
      {memories.length > 0 ? `Memory (${memories.length})` : 'Memory'}
    </ThemedText>
  </Pressable>
</View>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/chat/\[agentId\].tsx
git commit -m "feat: add heartbeat toggle to chat header"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -m uvicorn main:app --port 8001`

Verify: Server starts and logs "Scheduler started".

- [ ] **Step 2: Test job creation via API**

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/jobs \
  -H "Content-Type: application/json" \
  -d '{"schedule_ms": 60000}'
```

Expected: JSON with job details, `next_run` set to approximately now.

- [ ] **Step 3: Test job listing**

```bash
curl -s http://localhost:8001/agents/<AGENT_ID>/jobs
```

Expected: `{"jobs": [...]}`

- [ ] **Step 4: Wait for heartbeat to fire**

Wait ~60 seconds (or however long the schedule_ms was set), then check agent messages:

```bash
curl -s http://localhost:8001/agents/<AGENT_ID>/messages?limit=5
```

Expected: Either a new assistant message from the heartbeat, or the job's `last_run` updated (if suppressed).

- [ ] **Step 5: Test frontend**

Open `http://localhost:8081`, navigate to an agent's chat:
1. Header should show "Idle" in the header
2. Click "Idle" — should turn to "Live" (green), creating a heartbeat job
3. Click "Live" — should turn back to "Idle" (disabling the job)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 4 complete — heartbeat scheduling with smart suppression"
```
