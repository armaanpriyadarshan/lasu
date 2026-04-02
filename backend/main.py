import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db import save_message, get_recent_messages, get_or_create_user
from agent import run_agent
from models import MessageRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "sudo running"}


@app.get("/messages/{user_id}")
async def messages(user_id: str):
    rows = await get_recent_messages(user_id)
    return {"messages": rows}


@app.post("/message")
async def handle_message(req: MessageRequest):
    user = await get_or_create_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await save_message(req.user_id, "user", req.content)
    reply = await run_agent(req.user_id, req.content)
    await save_message(req.user_id, "assistant", reply)

    return {"reply": reply}
