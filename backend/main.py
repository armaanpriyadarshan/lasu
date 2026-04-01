import os

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv

load_dotenv()

from db import (
    get_user_by_phone, create_user, mark_user_verified, save_message,
    get_recent_messages, create_telegram_user, get_user_by_telegram,
    link_telegram, get_user_by_id,
)
from agent import run_agent
from sms import send_sms, send_verification, check_verification
from telegram import send_message as tg_send
from models import PhoneRequest, VerifyRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:19006"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "lasu running"}


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
        send_sms(phone, "Hey — download Lasu to get started.")
        return ""

    if not user["verified"]:
        send_sms(phone, "Please verify your number in the Lasu app first.")
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


@app.post("/auth/telegram")
async def auth_telegram():
    user = await create_telegram_user()
    return {"ok": True, "user_id": user["id"]}


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
            tg_send(chat_id, "Open the Lasu app to connect your account.")
            return {"ok": True}

    # Regular message
    user = await get_user_by_telegram(chat_id)
    if not user:
        tg_send(chat_id, "Open the Lasu app to connect your account first.")
        return {"ok": True}

    user_id = user["id"]
    await save_message(user_id, "user", text)
    reply = await run_agent(user_id, text)
    await save_message(user_id, "assistant", reply)
    tg_send(chat_id, reply)

    return {"ok": True}
