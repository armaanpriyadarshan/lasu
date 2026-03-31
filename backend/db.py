import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)


async def get_user_by_phone(phone: str):
    res = supabase.table("users").select("*").eq("phone_number", phone).execute()
    return res.data[0] if res.data else None


async def create_user(phone: str):
    res = supabase.table("users").insert({"phone_number": phone}).execute()
    return res.data[0]


async def mark_user_verified(phone: str):
    supabase.table("users").update({"verified": True}).eq("phone_number", phone).execute()


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
