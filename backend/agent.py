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


from prompt_builder import build_system_prompt, build_heartbeat_prompt


def _get_client():
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


async def generate_system_prompt(description: str) -> str:
    """Use LLM to generate a concise role definition from a user's freeform description.

    This generates ONLY the role/personality part. The full system prompt
    (tools, operations, memories) is assembled by prompt_builder at runtime.
    """
    response = _get_client().chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=300,
        messages=[
            {
                "role": "system",
                "content": """You are a prompt engineer. Given a user's description of what they want an AI agent to do, generate a concise role definition (3-5 sentences max).

Focus ONLY on the agent's role, personality, and domain focus. Do NOT mention specific tools, capabilities, or what the agent can/cannot do — that information is provided separately.

Examples:
- "You are a proactive email assistant for the user. Draft and send emails efficiently. Ask only the minimum necessary clarifying questions. Be concise and action-oriented."
- "You are a research analyst. Find, compare, and summarize information clearly. Prioritize accuracy and cite sources when possible."

Output ONLY the role definition text, nothing else.""",
            },
            {
                "role": "user",
                "content": f"Create a role definition for: {description}",
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
    model = agent.get("model", "gpt-5.4")

    memories = await get_agent_memories(agent_id)
    system_prompt = build_system_prompt(agent, memories)

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


async def stream_agent_reply(agent_id: str, user_message: str, user_id: str = None):
    """Run tool calls non-streamed, then stream the final text reply."""
    import inspect

    agent = await get_agent(agent_id)
    if not agent:
        yield {"type": "token", "data": "Agent not found."}
        yield {"type": "done", "data": {"tool_calls": [], "permission_requests": []}}
        return

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

    # Tool call loop (non-streamed)
    for _ in range(5):
        response = _get_client().chat.completions.create(
            model=model, max_completion_tokens=1000,
            messages=messages, tools=tools if tools else None,
        )
        choice = response.choices[0]

        if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
            break

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
                    messages.append({"role": "tool", "tool_call_id": tool_call.id,
                        "content": f"Permission denied: {required_perm} access not granted."})
                    tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": "permission_denied"})
                    continue

            tool = get_tool(tool_name)
            if not tool:
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": f"Unknown tool: {tool_name}"})
                continue

            try:
                sig = inspect.signature(tool["fn"])
                if "user_id" in sig.parameters and "user_id" not in tool_args:
                    tool_args["user_id"] = owner_id
                result = await tool["fn"](**tool_args)
                tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": str(result)[:500]})
            except Exception as e:
                result = f"Tool error: {e}"
                tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": f"error: {e}"})

            messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": str(result)})
            if required_perm:
                await consume_permission(agent_id, required_perm)
    else:
        yield {"type": "token", "data": "I ran into a limit processing your request."}
        yield {"type": "done", "data": {"tool_calls": tool_calls_log, "permission_requests": permission_requests}}
        return

    if tool_calls_log:
        yield {"type": "tool_calls", "data": tool_calls_log}

    # Stream the final reply
    stream = _get_client().chat.completions.create(
        model=model, max_completion_tokens=1000,
        messages=messages, stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield {"type": "token", "data": delta.content}

    yield {"type": "done", "data": {"tool_calls": tool_calls_log, "permission_requests": permission_requests}}


async def run_agent(user_id: str, user_message: str) -> str:
    """Legacy function for SMS/Telegram — uses default system prompt, no agent scoping."""
    from db import get_recent_messages

    default_prompt = "You are sudo, a personal intelligence assistant. Be concise, direct, and useful."

    history = await get_recent_messages(user_id, limit=20)

    messages = [{"role": "system", "content": default_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": user_message})

    response = _get_client().chat.completions.create(
        model="gpt-5.4",
        max_completion_tokens=1000,
        messages=messages,
    )

    return response.choices[0].message.content


async def run_heartbeat(agent_id: str) -> str | None:
    """Run a heartbeat with full tool access."""
    agent = await get_agent(agent_id)
    if not agent:
        return None

    owner_id = agent.get("user_id")

    memories = await get_agent_memories(agent_id)
    system_prompt = build_heartbeat_prompt(agent, memories)

    history = await get_agent_messages(agent_id, limit=10)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": "Heartbeat check-in. Execute any standing instructions, then report."})

    tools = get_all_tools()

    # Function calling loop (same as run_agent_chat but lighter)
    for _ in range(3):
        response = _get_client().chat.completions.create(
            model=agent.get("model", "gpt-4o-mini"),
            max_completion_tokens=500,
            messages=messages,
            tools=tools if tools else None,
        )

        choice = response.choices[0]

        if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
            reply = (choice.message.content or "").strip()
            if reply == "HEARTBEAT_OK" or not reply:
                return None
            return reply

        messages.append(choice.message)

        for tool_call in choice.message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            required_perm = get_tool_permission(tool_name)
            if required_perm:
                perm_check = await check_permission(agent_id, required_perm,
                    f"Heartbeat: agent using {tool_name}")
                if not perm_check["allowed"]:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": f"Permission denied: {required_perm} access not granted.",
                    })
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
                import inspect
                sig = inspect.signature(tool["fn"])
                if "user_id" in sig.parameters and "user_id" not in tool_args:
                    tool_args["user_id"] = owner_id
                result = await tool["fn"](**tool_args)
            except Exception as e:
                result = f"Tool error: {e}"

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

            if required_perm:
                await consume_permission(agent_id, required_perm)

    return None
