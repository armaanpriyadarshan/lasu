import os
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
