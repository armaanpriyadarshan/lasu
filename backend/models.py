from pydantic import BaseModel


class PhoneRequest(BaseModel):
    phone: str  # E.164 format


class VerifyRequest(BaseModel):
    phone: str
    code: str
