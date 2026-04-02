import json
import os
from openai import OpenAI
from db import get_agent_messages, get_agent, get_agent_memories
from tools import get_all_tools, get_tool, get_tool_permission
from tools.web_research import register_web_tools
from tools.calendar import register_calendar_tools
from tools.email import register_email_tools
from tools.contacts import register_contacts_tools
from tools.files import register_files_tools
from permissions import check_permission, consume_permission

# Register all tools
register_web_tools()
register_calendar_tools()
register_email_tools()
register_contacts_tools()
register_files_tools()


def _get_client():
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])

DEFAULT_SYSTEM_PROMPT = """You are sudo, a personal intelligence assistant running 24/7 on behalf of this user.
You know them deeply and respond with that context. You are concise, direct, and useful.
Never use filler. Respond like a trusted assistant who knows this person well.

Keep responses concise. Prioritize usefulness over brevity.
Do not use markdown formatting. Plain text only."""


async def generate_system_prompt(description: str) -> str:
    """Use LLM to generate an effective system prompt from a user's freeform description."""
    response = _get_client().chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=500,
        messages=[
            {
                "role": "system",
                "content": """You are a prompt engineer. Given a user's description of what they want an AI agent to do, generate a concise, effective system prompt for that agent.

The agent has access to real tools it can use:
- web_search: Search the web for information
- web_fetch: Fetch and read web pages
- list_calendar_events / create_calendar_event: Read and create Google Calendar events
- read_inbox / send_email: Read and send emails via Gmail
- list_contacts: Search Google Contacts
- list_drive_files / read_drive_file: Browse and read Google Drive files

The agent also has autonomous capabilities:
- It can run persistently via a heartbeat system, waking up on a schedule to check on things and proactively reach out
- It can handle recurring tasks — if the user asks for something to happen regularly, the agent can do it on its heartbeat cycle
- It remembers facts and preferences about the user across conversations

The agent CAN and SHOULD use these tools when relevant. Do NOT tell the agent it cannot perform actions — it has real tool access and autonomous capabilities. The prompt should encourage the agent to take action using its tools rather than just offering to draft things. If asked to do something repeatedly or on a schedule, the agent should confirm it can handle that through its persistent operation.

Output ONLY the system prompt text, nothing else.""",
            },
            {
                "role": "user",
                "content": f"Create a system prompt for an AI agent with this description: {description}",
            },
        ],
    )
    return response.choices[0].message.content


async def run_agent_chat(agent_id: str, user_message: str, user_id: str = None) -> dict:
    """Run a chat turn. Returns {"reply": str, "tool_calls": list, "permission_requests": list}."""
    agent = await get_agent(agent_id)
    if not agent:
        return {"reply": "Agent not found.", "tool_calls": [], "permission_requests": []}

    # user_id for auto-injecting into tools that need it
    owner_id = user_id or agent.get("user_id")

    system_prompt = agent.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    model = agent.get("model", "gpt-5.4")

    memories = await get_agent_memories(agent_id)
    if memories:
        memory_text = "\n".join(f"- {m['key']}: {m['value']}" for m in memories)
        system_prompt += f"\n\nThings you remember about this user:\n{memory_text}"

    history = await get_agent_messages(agent_id, limit=20)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    tools = get_all_tools()
    tool_calls_log = []
    permission_requests = []

    for _ in range(5):
        response = _get_client().chat.completions.create(
            model=model,
            max_completion_tokens=1000,
            messages=messages,
            tools=tools if tools else None,
        )

        choice = response.choices[0]

        if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
            return {
                "reply": choice.message.content or "",
                "tool_calls": tool_calls_log,
                "permission_requests": permission_requests,
            }

        messages.append(choice.message)

        for tool_call in choice.message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            required_perm = get_tool_permission(tool_name)
            if required_perm:
                perm_check = await check_permission(agent_id, required_perm,
                    f"Agent wants to use {tool_name}: {json.dumps(tool_args)}")
                if not perm_check["allowed"]:
                    permission_requests.append(perm_check.get("request"))
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": f"Permission denied: {required_perm} access not granted. Ask the user to approve.",
                    })
                    tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": "permission_denied"})
                    continue

            tool = get_tool(tool_name)
            if not tool:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": f"Unknown tool: {tool_name}",
                })
                continue

            try:
                # Auto-inject user_id for tools that need it
                import inspect
                sig = inspect.signature(tool["fn"])
                if "user_id" in sig.parameters and "user_id" not in tool_args:
                    tool_args["user_id"] = owner_id
                result = await tool["fn"](**tool_args)
                tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": str(result)[:500]})
            except Exception as e:
                result = f"Tool error: {e}"
                tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": f"error: {e}"})

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

            if required_perm:
                await consume_permission(agent_id, required_perm)

    return {
        "reply": "I ran into a limit processing your request. Please try again.",
        "tool_calls": tool_calls_log,
        "permission_requests": permission_requests,
    }


async def run_agent(user_id: str, user_message: str) -> str:
    """Legacy function for SMS/Telegram — uses default system prompt, no agent scoping."""
    from db import get_recent_messages

    history = await get_recent_messages(user_id, limit=20)

    messages = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    response = _get_client().chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=1000,
        messages=messages,
    )

    return response.choices[0].message.content


HEARTBEAT_PROMPT = """You are checking in on behalf of this user. Review what you know about them and any recent context.

If you have something useful to proactively share — a reminder, a follow-up, a suggestion, or an observation — respond with it concisely.

If there's nothing worth mentioning right now, respond with exactly: HEARTBEAT_OK

Do not make up tasks or fabricate urgency. Only speak if you have something genuinely useful to say."""


async def run_heartbeat(agent_id: str) -> str | None:
    agent = await get_agent(agent_id)
    if not agent:
        return None

    system_prompt = agent.get("system_prompt") or DEFAULT_SYSTEM_PROMPT

    memories = await get_agent_memories(agent_id)
    if memories:
        memory_text = "\n".join(f"- {m['key']}: {m['value']}" for m in memories)
        system_prompt += f"\n\nThings you remember about this user:\n{memory_text}"

    history = await get_agent_messages(agent_id, limit=5)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": HEARTBEAT_PROMPT})

    response = _get_client().chat.completions.create(
        model=agent.get("model", "gpt-4o-mini"),
        max_completion_tokens=300,
        messages=messages,
    )

    reply = response.choices[0].message.content.strip()

    if reply == "HEARTBEAT_OK" or not reply:
        return None

    return reply
