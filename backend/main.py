import hashlib
import hmac
import os
import time
from urllib.parse import urlencode

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
from dotenv import load_dotenv

load_dotenv()

from db import (
    get_user_by_phone, create_user, mark_user_verified, save_message,
    get_recent_messages, create_telegram_user, get_user_by_telegram,
    link_telegram, get_user_by_id,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
)
from agent import run_agent, run_agent_chat, generate_system_prompt
from sms import send_sms, send_verification, check_verification
from telegram import send_message as tg_send
from models import PhoneRequest, VerifyRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:19006"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "sudo running"}


@app.get("/config")
def config():
    return {"sms_number": os.environ["TWILIO_PHONE_NUMBER"]}


@app.get("/messages/{user_id}")
async def messages(user_id: str):
    rows = await get_recent_messages(user_id)
    return {"messages": rows}


# --- Twilio SMS webhook ---

@app.post("/sms", response_class=PlainTextResponse)
async def handle_sms(From: str = Form(), Body: str = Form()):
    phone = From.strip()
    message = Body.strip()

    user = await get_user_by_phone(phone)

    if not user:
        send_sms(phone, "Hey — download sudo to get started.")
        return ""

    if not user["verified"]:
        send_sms(phone, "Please verify your number in the sudo app first.")
        return ""

    user_id = user["id"]

    await save_message(user_id, "user", message)

    reply = await run_agent(user_id, message)

    await save_message(user_id, "assistant", reply)

    send_sms(phone, reply)

    return ""


# --- Auth endpoints ---

@app.post("/auth/send-code")
async def send_code(req: PhoneRequest):
    send_verification(req.phone)
    return {"ok": True}


@app.post("/auth/verify")
async def verify(req: VerifyRequest):
    verified = check_verification(req.phone, req.code)
    if not verified:
        raise HTTPException(status_code=400, detail="Invalid code")

    user = await get_user_by_phone(req.phone)
    if not user:
        user = await create_user(req.phone)

    await mark_user_verified(req.phone)

    return {"ok": True, "user_id": user["id"]}


@app.get("/auth/telegram/login", response_class=HTMLResponse)
async def telegram_login():
    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "superuser_do_bot")
    origin = os.environ.get("APP_URL", "http://localhost:8000")
    callback_url = f"{origin}/auth/telegram/callback"
    return f"""<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>sudo — sign in with telegram</title>
<style>body{{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#F5F0E6;font-family:serif}}</style>
</head><body>
<script async src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="{bot_username}"
  data-size="large"
  data-auth-url="{callback_url}"
  data-request-access="write"></script>
</body></html>"""


def verify_telegram_auth(data: dict) -> bool:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    check_hash = data.pop("hash", None)
    if not check_hash:
        return False
    # Telegram says auth older than 1 day is invalid
    if abs(time.time() - int(data.get("auth_date", 0))) > 86400:
        return False
    secret = hashlib.sha256(token.encode()).digest()
    check_string = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    computed = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return computed == check_hash


@app.get("/auth/telegram/callback")
async def telegram_callback(request: Request):
    params = dict(request.query_params)
    data = {k: v for k, v in params.items()}
    hash_value = data.get("hash", "")
    telegram_id = int(data.get("id", 0))

    if not verify_telegram_auth(data):
        raise HTTPException(status_code=400, detail="Invalid Telegram auth")

    # Find or create user by telegram_chat_id
    user = await get_user_by_telegram(telegram_id)
    if not user:
        user = await create_telegram_user()
        await link_telegram(user["id"], telegram_id)

    user_id = user["id"]
    scheme = os.environ.get("APP_SCHEME", "lasu")
    return RedirectResponse(f"{scheme}://auth/telegram?user_id={user_id}")


# --- Agent endpoints ---

@app.post("/agents")
async def create_agent_endpoint(req: CreateAgentRequest):
    system_prompt = await generate_system_prompt(req.description)
    try:
        agent = await create_agent(req.user_id, req.name, req.description, system_prompt)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return agent


@app.get("/agents")
async def list_agents(user_id: str):
    agents = await get_agents(user_id)
    return {"agents": agents}


@app.get("/agents/{agent_id}")
async def get_agent_endpoint(agent_id: str):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch("/agents/{agent_id}")
async def update_agent_endpoint(agent_id: str, req: UpdateAgentRequest):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    agent = await update_agent(agent_id, updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.delete("/agents/{agent_id}")
async def delete_agent_endpoint(agent_id: str):
    success = await delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"ok": True}


@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await save_agent_message(agent_id, req.user_id, "user", req.message)

    reply = await run_agent_chat(agent_id, req.message)

    await save_agent_message(agent_id, req.user_id, "assistant", reply)

    return {"reply": reply}


@app.get("/agents/{agent_id}/messages")
async def get_agent_messages_endpoint(agent_id: str, limit: int = 50):
    messages = await get_agent_messages(agent_id, limit)
    return {"messages": messages}


# --- User info ---

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user["id"],
        "phone_number": user.get("phone_number"),
        "telegram_chat_id": user.get("telegram_chat_id"),
    }


# --- Telegram webhook ---

@app.post("/telegram")
async def handle_telegram(request: Request):
    body = await request.json()
    message = body.get("message")
    if not message or not message.get("text"):
        return {"ok": True}

    chat_id = message["chat"]["id"]
    text = message["text"].strip()

    # Handle /start with user_id linking
    if text.startswith("/start"):
        parts = text.split()
        if len(parts) == 2:
            user_id = parts[1]
            await link_telegram(user_id, chat_id)
            tg_send(chat_id, "Connected. Send me a message to get started.")
            return {"ok": True}
        else:
            tg_send(chat_id, "Open the sudo app to connect your account.")
            return {"ok": True}

    # Regular message
    user = await get_user_by_telegram(chat_id)
    if not user:
        tg_send(chat_id, "Open the sudo app to connect your account first.")
        return {"ok": True}

    user_id = user["id"]
    await save_message(user_id, "user", text)
    reply = await run_agent(user_id, text)
    await save_message(user_id, "assistant", reply)
    tg_send(chat_id, reply)

    return {"ok": True}
