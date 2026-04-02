from typing import Optional

from pydantic import BaseModel


class PhoneRequest(BaseModel):
    phone: str  # E.164 format


class VerifyRequest(BaseModel):
    phone: str
    code: str


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
