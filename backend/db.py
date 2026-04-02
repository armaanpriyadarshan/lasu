import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)


async def get_or_create_user(user_id: str):
    res = supabase.table("users").select("*").eq("id", user_id).execute()
    if res.data:
        return res.data[0]
    res = supabase.table("users").insert({"id": user_id}).execute()
    return res.data[0] if res.data else None


async def get_recent_messages(user_id: str, limit: int = 20):
    res = (
        supabase.table("messages")
        .select("role, content")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data))


async def save_message(user_id: str, role: str, content: str):
    supabase.table("messages").insert({
        "user_id": user_id,
        "role": role,
        "content": content
    }).execute()


async def get_dashboard_stats(user_id: str) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00+00:00")

    # Messages today
    msg_res = (
        supabase.table("messages")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", today)
        .execute()
    )
    messages_today = msg_res.count or 0

    # Active agents
    agent_res = (
        supabase.table("agents")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    active_agents = agent_res.count or 0

    # Total memories across all agents
    agent_ids_res = supabase.table("agents").select("id").eq("user_id", user_id).eq("is_active", True).execute()
    agent_ids = [a["id"] for a in agent_ids_res.data]
    total_memories = 0
    if agent_ids:
        mem_res = (
            supabase.table("agent_memory")
            .select("id", count="exact")
            .in_("agent_id", agent_ids)
            .execute()
        )
        total_memories = mem_res.count or 0

    # Recent activity: last 10 messages across all agents
    activity_res = (
        supabase.table("messages")
        .select("id, role, content, created_at, agent_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Map agent_id to agent name
    agent_names = {}
    if agent_ids:
        names_res = supabase.table("agents").select("id, name").in_("id", agent_ids).execute()
        agent_names = {a["id"]: a["name"] for a in names_res.data}

    activity = []
    for msg in activity_res.data:
        agent_name = agent_names.get(msg.get("agent_id"), "sudo")
        activity.append({
            "id": msg["id"],
            "text": f"{agent_name}: {msg['content'][:80]}" if msg["role"] == "assistant" else msg["content"][:80],
            "role": msg["role"],
            "created_at": msg["created_at"],
            "agent_name": agent_name,
        })

    return {
        "messages_today": messages_today,
        "active_agents": active_agents,
        "total_memories": total_memories,
        "activity": activity,
    }


# ── Agent functions ──

AGENT_LIMITS = {"free": 1, "pro": 5, "enterprise": 25}


async def create_agent(user_id: str, name: str, description: str, system_prompt: str):
    existing = supabase.table("agents").select("id").eq("user_id", user_id).eq("is_active", True).execute()
    if len(existing.data) >= 5:
        raise ValueError("Agent limit reached")
    res = supabase.table("agents").insert({
        "user_id": user_id,
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
    }).execute()
    return res.data[0] if res.data else None


async def get_agents(user_id: str):
    res = (
        supabase.table("agents")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def get_agent(agent_id: str):
    res = supabase.table("agents").select("*").eq("id", agent_id).eq("is_active", True).execute()
    return res.data[0] if res.data else None


async def update_agent(agent_id: str, updates: dict):
    res = (
        supabase.table("agents")
        .update(updates)
        .eq("id", agent_id)
        .eq("is_active", True)
        .execute()
    )
    return res.data[0] if res.data else None


async def delete_agent(agent_id: str):
    res = supabase.table("agents").update({"is_active": False}).eq("id", agent_id).execute()
    return len(res.data) > 0


async def get_agent_messages(agent_id: str, limit: int = 50):
    res = (
        supabase.table("messages")
        .select("role, content, created_at")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data))


async def save_agent_message(agent_id: str, user_id: str, role: str, content: str):
    supabase.table("messages").insert({
        "agent_id": agent_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "channel": "app",
    }).execute()


# ── Memory functions ──

async def get_agent_memories(agent_id: str) -> list:
    res = (
        supabase.table("agent_memory")
        .select("*")
        .eq("agent_id", agent_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return res.data


async def upsert_memory(agent_id: str, key: str, value: str, source: str = "extracted", confidence: float = 0.8):
    res = (
        supabase.table("agent_memory")
        .upsert(
            {
                "agent_id": agent_id,
                "key": key,
                "value": value,
                "source": source,
                "confidence": confidence,
                "updated_at": "now()",
            },
            on_conflict="agent_id,key",
        )
        .execute()
    )
    return res.data[0] if res.data else None


async def delete_memory(memory_id: str) -> bool:
    res = supabase.table("agent_memory").delete().eq("id", memory_id).execute()
    return len(res.data) > 0


# ── Permission functions ──

async def get_agent_permissions(agent_id: str) -> list:
    res = (
        supabase.table("agent_permissions")
        .select("*")
        .eq("agent_id", agent_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return res.data


async def has_permission(agent_id: str, permission: str) -> bool:
    res = (
        supabase.table("agent_permissions")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


async def grant_permission(agent_id: str, permission: str, grant_type: str = "permanent") -> dict:
    res = supabase.table("agent_permissions").insert({
        "agent_id": agent_id,
        "permission": permission,
        "grant_type": grant_type,
    }).execute()
    return res.data[0] if res.data else None


async def revoke_permission(permission_id: str) -> bool:
    res = (
        supabase.table("agent_permissions")
        .update({"revoked_at": "now()"})
        .eq("id", permission_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


async def use_one_time_permission(agent_id: str, permission: str) -> bool:
    res = (
        supabase.table("agent_permissions")
        .update({"revoked_at": "now()", "expires_at": "now()"})
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .eq("grant_type", "one_time")
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


# ── Permission request functions ──

async def create_permission_request(agent_id: str, permission: str, reason: str) -> dict:
    existing = (
        supabase.table("permission_requests")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        return existing.data[0]

    res = supabase.table("permission_requests").insert({
        "agent_id": agent_id,
        "permission": permission,
        "reason": reason,
    }).execute()
    return res.data[0] if res.data else None


async def get_pending_requests(agent_id: str) -> list:
    res = (
        supabase.table("permission_requests")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def resolve_permission_request(request_id: str, status: str, grant_type: str = None) -> dict | None:
    update = {"status": status, "resolved_at": "now()"}
    if grant_type:
        update["grant_type"] = grant_type
    res = (
        supabase.table("permission_requests")
        .update(update)
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )
    return res.data[0] if res.data else None


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
    res = (
        supabase.table("agent_jobs")
        .select("*, agents!inner(id, user_id, name, system_prompt, model, is_active)")
        .eq("enabled", True)
        .lte("next_run", "now()")
        .execute()
    )
    return [j for j in res.data if j.get("agents", {}).get("is_active", False)]


async def mark_job_ran(job_id: str, schedule_ms: int):
    supabase.rpc("mark_job_ran", {"job_id_param": job_id, "schedule_ms_param": schedule_ms}).execute()
