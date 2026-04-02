from typing import Optional

from pydantic import BaseModel


class MessageRequest(BaseModel):
    user_id: str
    content: str


class CreateAgentRequest(BaseModel):
    user_id: str
    name: str
    description: str


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None


class ChatRequest(BaseModel):
    user_id: str
    message: str


class GrantPermissionRequest(BaseModel):
    grant_type: str  # "one_time" or "permanent"
