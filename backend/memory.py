import json
import os
from openai import OpenAI


def _get_client():
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


EXTRACTION_PROMPT = """You are a memory extraction system. Given a conversation between a user and an AI agent, extract facts and preferences about the user that would be useful to remember for future conversations.

You will also be given EXISTING MEMORIES that have already been saved. Use these to:
- SKIP facts that are already captured (don't re-extract what's already known)
- REUSE the same key if the user updates or refines an existing fact (this will overwrite the old value)
- Only create NEW keys for genuinely new information

Rules:
- Only extract facts the USER stated or clearly implied (not the agent's suggestions)
- Each fact should have a short key (snake_case, max 30 chars) and a value (the fact itself)
- Skip trivial or one-time facts (e.g., "user said hello")
- Focus on: preferences, habits, personal info, work context, relationships, goals
- If the user corrects or updates a previous statement, use the SAME KEY with the updated value
- Return an empty array if nothing new or updated was said

Return ONLY valid JSON in this format:
[{"key": "preferred_name", "value": "Goes by Alex"}, {"key": "work_role", "value": "Senior engineer at Stripe"}]

If nothing worth remembering: []"""


async def extract_memories(user_message: str, agent_reply: str, existing_memories: list[dict] = None) -> list[dict]:
    """Extract memorable facts from a conversation turn. Returns list of {key, value} dicts."""
    existing_text = ""
    if existing_memories:
        existing_text = "\n\nEXISTING MEMORIES:\n" + "\n".join(f"- {m['key']}: {m['value']}" for m in existing_memories)

    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        max_completion_tokens=300,
        temperature=0,
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": f"User said: {user_message}\n\nAgent replied: {agent_reply}{existing_text}"},
        ],
    )

    text = response.choices[0].message.content.strip()
    try:
        memories = json.loads(text)
        if not isinstance(memories, list):
            return []
        return [m for m in memories if isinstance(m, dict) and "key" in m and "value" in m]
    except json.JSONDecodeError:
        return []
