import os
from openai import OpenAI
from db import get_agent_messages, get_agent

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

DEFAULT_SYSTEM_PROMPT = """You are sudo, a personal intelligence assistant running 24/7 on behalf of this user.
You know them deeply and respond with that context. You are concise, direct, and useful.
Never use filler. Respond like a trusted assistant who knows this person well.

You are communicating over SMS. Keep responses under 300 characters when possible.
If a response needs to be longer, that is fine — prioritize usefulness over brevity.
Do not use markdown formatting. Plain text only."""


async def generate_system_prompt(description: str) -> str:
    """Use LLM to generate an effective system prompt from a user's freeform description."""
    response = client.chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=500,
        messages=[
            {
                "role": "system",
                "content": "You are a prompt engineer. Given a user's description of what they want an AI agent to do, generate a concise, effective system prompt for that agent. The prompt should define the agent's role, personality, and boundaries. Output ONLY the system prompt text, nothing else.",
            },
            {
                "role": "user",
                "content": f"Create a system prompt for an AI agent with this description: {description}",
            },
        ],
    )
    return response.choices[0].message.content


async def run_agent_chat(agent_id: str, user_message: str) -> str:
    """Run a chat turn for a specific agent."""
    agent = await get_agent(agent_id)
    if not agent:
        return "Agent not found."

    system_prompt = agent.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    model = agent.get("model", "gpt-5.4")

    history = await get_agent_messages(agent_id, limit=20)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=model,
        max_completion_tokens=1000,
        messages=messages,
    )

    return response.choices[0].message.content


async def run_agent(user_id: str, user_message: str) -> str:
    """Legacy function for SMS/Telegram — uses default system prompt, no agent scoping."""
    from db import get_recent_messages

    history = await get_recent_messages(user_id, limit=20)

    messages = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=1000,
        messages=messages,
    )

    return response.choices[0].message.content
