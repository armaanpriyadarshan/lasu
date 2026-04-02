from fastapi import HTTPException, Request
from db import supabase


async def get_current_user(request: Request) -> str:
    """Verify the Supabase access token and return the user ID."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth[7:]
    try:
        res = supabase.auth.get_user(token)
        if not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
