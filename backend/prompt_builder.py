"""
Prompt builder for Sudo agents.

Assembles the system prompt from separated concerns (like OpenClaw's file-based approach):
- IDENTITY: Who the agent is (name, role, description)
- SOUL: Personality and communication style
- OPERATIONS: What tools are available, how to use them, operational rules
- USER CONTEXT: Memories, preferences, learned facts about the user
- STANDING INSTRUCTIONS: Recurring tasks, heartbeat behavior

Each concern is its own section so they can evolve independently without
conflicting. Personality is stable; operations change when tools are added;
user context grows over time.
"""

from datetime import datetime
from tools import TOOL_REGISTRY


# ── SOUL (personality layer — stable across all agents) ──

SOUL = """## Communication Style

- Lead with the answer or action, not the reasoning
- Be concise and direct — no filler, no preamble
- Have opinions when the evidence supports it
- Use markdown formatting when helpful: **bold**, *italic*, `code`, bullet lists
- Do not use em dashes or overly formal language
- Sound like a trusted colleague, not a customer service bot
- If you're uncertain, say so — don't fabricate confidence"""


# ── OPERATIONS (what the agent can do — system-generated) ──

def build_operations_section() -> str:
    """Build the operations section from registered tools."""
    lines = ["## Your Capabilities", ""]
    lines.append("You have access to real tools and SHOULD use them proactively:")
    lines.append("")

    tool_groups: dict[str, list[str]] = {}
    for tool in TOOL_REGISTRY.values():
        perm = tool["permission"]
        desc = f"- **{tool['name']}**: {tool['description']}"
        tool_groups.setdefault(perm, []).append(desc)

    for perm, tools in tool_groups.items():
        lines.append(f"### {perm.title()} tools (requires '{perm}' permission)")
        lines.extend(tools)
        lines.append("")

    lines.append("### Autonomous Operation")
    lines.append("- You run persistently via a heartbeat system, waking up on a schedule")
    lines.append("- You can handle recurring tasks — if the user asks for something to happen regularly, AGREE and do it")
    lines.append("- On each heartbeat wake-up, you execute any standing instructions the user has given you")
    lines.append("- You remember facts and preferences about the user across conversations")
    lines.append("")
    lines.append("### Rules")
    lines.append("- ALWAYS use tools when the task calls for it — do not just describe what you would do")
    lines.append("- If you lack permission for a tool, the system will prompt the user — just attempt the action")
    lines.append("- If Google account is not connected, the user will be prompted automatically — just attempt the action")
    lines.append("- If asked to do something recurring, confirm you will handle it and do the first one immediately")
    lines.append("- Do not expand scope beyond what was requested")
    lines.append("- Do not make up information — use web_search if you need current facts")

    return "\n".join(lines)


# ── PROMPT ASSEMBLY ──

def build_system_prompt(agent: dict, memories: list = None) -> str:
    """Assemble the full system prompt for a chat turn."""
    sections = []

    # IDENTITY
    name = agent.get("name", "Agent")
    description = agent.get("description", "")
    custom_prompt = agent.get("system_prompt", "")

    sections.append(f"# You are {name}")
    sections.append("")
    if custom_prompt:
        sections.append(custom_prompt)
    elif description:
        sections.append(f"Your role: {description}")
    sections.append("")

    # SOUL
    sections.append(SOUL)
    sections.append("")

    # OPERATIONS
    sections.append(build_operations_section())
    sections.append("")

    # USER CONTEXT (memories)
    if memories:
        sections.append("## What You Know About This User")
        sections.append("")
        for m in memories:
            sections.append(f"- **{m['key'].replace('_', ' ')}**: {m['value']}")
        sections.append("")

    # RUNTIME
    sections.append(f"## Runtime")
    sections.append(f"- Current time: {datetime.utcnow().isoformat()}Z")
    sections.append(f"- Platform: Sudo (hosted agent platform)")
    sections.append(f"- Agent ID: {agent.get('id', 'unknown')}")

    return "\n".join(sections)


def build_heartbeat_prompt(agent: dict, memories: list = None) -> str:
    """Assemble the system prompt for a heartbeat wake-up."""
    base = build_system_prompt(agent, memories)

    heartbeat_section = """

## Heartbeat Wake-Up

You are waking up on your regular heartbeat cycle. This is NOT a user message — this is your scheduled check-in.

**Priority order:**
1. Execute any standing instructions the user has given you (recurring emails, scheduled checks, etc.)
2. If you have something useful to proactively share — a reminder, follow-up, or observation — do it
3. If there are no standing tasks and nothing worth mentioning, respond with exactly: HEARTBEAT_OK

Do not make up tasks. Do not fabricate urgency. But DO execute recurring instructions immediately using your tools."""

    return base + heartbeat_section
