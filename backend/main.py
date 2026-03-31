from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv

load_dotenv()

from db import get_user_by_phone, create_user, mark_user_verified, save_message
from agent import run_agent
from sms import send_sms, send_verification, check_verification
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
