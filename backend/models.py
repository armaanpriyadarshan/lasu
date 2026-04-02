from pydantic import BaseModel


class MessageRequest(BaseModel):
    user_id: str
    content: str
