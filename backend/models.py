from typing import Optional

from pydantic import BaseModel


class MessageRequest(BaseModel):
    user_id: str
    content: str


class CreateAgentRequest(BaseModel):
    user_id: str
    name: str
    description: str
    emoji: str = "🤖"
    tone: str = "balanced"


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None


class ChatRequest(BaseModel):
    user_id: str
    message: str


class GrantPermissionRequest(BaseModel):
    grant_type: str = "permanent"  # "one_time" or "permanent"
    permission: Optional[str] = None  # for direct grants


class CreateJobRequest(BaseModel):
    schedule_ms: int = 1800000
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None


class UpdateJobRequest(BaseModel):
    schedule_ms: Optional[int] = None
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None
    enabled: Optional[bool] = None
