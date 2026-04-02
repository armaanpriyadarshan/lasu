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

async def create_agent(user_id: str, name: str, description: str, system_prompt: str):
    # Enforce agent limit per user (e.g. 5 agents max on free tier)
    existing = supabase.table("agents").select("id").eq("user_id", user_id).execute()
    if len(existing.data) >= 5:
        raise ValueError("Agent limit reached (max 5 per user)")
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
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def get_agent(agent_id: str):
    res = supabase.table("agents").select("*").eq("id", agent_id).execute()
    return res.data[0] if res.data else None


async def update_agent(agent_id: str, updates: dict):
    res = (
        supabase.table("agents")
        .update(updates)
        .eq("id", agent_id)
        .execute()
    )
    return res.data[0] if res.data else None


async def delete_agent(agent_id: str):
    res = supabase.table("agents").delete().eq("id", agent_id).execute()
    return bool(res.data)


async def get_agent_messages(agent_id: str, limit: int = 50):
    res = (
        supabase.table("agent_messages")
        .select("role, content, created_at")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data))


async def save_agent_message(agent_id: str, user_id: str, role: str, content: str):
    supabase.table("agent_messages").insert({
        "agent_id": agent_id,
        "user_id": user_id,
        "role": role,
        "content": content,
    }).execute()
