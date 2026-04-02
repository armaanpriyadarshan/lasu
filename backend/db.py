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
