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
