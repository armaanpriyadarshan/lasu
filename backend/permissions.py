from db import has_permission, create_permission_request, use_one_time_permission

VALID_PERMISSIONS = {"calendar", "email", "web", "sms", "voice", "contacts", "files"}


async def check_permission(agent_id: str, permission: str, reason: str = "") -> dict:
    if permission not in VALID_PERMISSIONS:
        return {"allowed": False, "error": f"Unknown permission: {permission}"}

    if await has_permission(agent_id, permission):
        return {"allowed": True}

    request = await create_permission_request(
        agent_id, permission, reason or f"Agent needs {permission} access"
    )
    return {"allowed": False, "request": request}


async def consume_permission(agent_id: str, permission: str):
    await use_one_time_permission(agent_id, permission)
