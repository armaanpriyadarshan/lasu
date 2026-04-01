import os
import requests

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TOKEN}"


def send_message(chat_id: int, text: str):
    requests.post(f"{API}/sendMessage", json={"chat_id": chat_id, "text": text})
