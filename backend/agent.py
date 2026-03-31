import os
from openai import OpenAI
from db import get_recent_messages

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SYSTEM_PROMPT = """You are Lasu, a personal intelligence assistant running 24/7 on behalf of this user.
You know them deeply and respond with that context. You are concise, direct, and useful.
Never use filler. Respond like a trusted assistant who knows this person well.

You are communicating over SMS. Keep responses under 300 characters when possible.
If a response needs to be longer, that is fine — prioritize usefulness over brevity.
Do not use markdown formatting. Plain text only."""


async def run_agent(user_id: str, user_message: str) -> str:
    history = await get_recent_messages(user_id, limit=20)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=1000,
        messages=messages
    )

    return response.choices[0].message.content
