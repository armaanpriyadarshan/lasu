# Phase 5A: Tool Framework + Web Research — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tool execution framework (registry, permission enforcement, OpenAI function calling) and ship the first tool — web research — so agents can autonomously search the web and fetch pages.

**Architecture:** A tool registry maps tool names to callables + required permissions. When the LLM invokes a function call, the framework checks permissions (using Phase 3 infrastructure), executes the tool if allowed, or creates a permission request if not. The chat response includes tool activity so users see what the agent did. Web research uses Tavily Search API for search and httpx for page fetching.

**Tech Stack:** Supabase, FastAPI, OpenAI function calling, Tavily API, httpx, Expo Router, React Native, TypeScript

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/tools/__init__.py` | **New** — tool registry (register, list, get tools) |
| `backend/tools/web_research.py` | **New** — web search (Tavily) + page fetch (httpx) tool implementations |
| `backend/agent.py` | Refactor `run_agent_chat` to use OpenAI function calling with registered tools |
| `backend/main.py` | Update chat endpoint to handle tool calls and permission requests in response |
| `src/app/(app)/chat/[agentId].tsx` | Render tool activity cards in chat messages |
| `src/lib/api.ts` | Update AgentMessage type to include tool activity |

## Environment Variables Needed

Add to `backend/.env`:
```
TAVILY_API_KEY=tvly-your-tavily-api-key-here
```

Get a key at https://tavily.com (free tier: 1000 searches/month).

---

### Task 1: Install dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add tavily-python to requirements.txt**

Add this line to the end of `backend/requirements.txt`:

```
tavily-python
```

- [ ] **Step 2: Install**

Run: `cd /c/Users/ezhou/projects/lasu/backend && pip install tavily-python`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add tavily-python dependency for web research"
```

---

### Task 2: Tool registry

**Files:**
- Create: `backend/tools/__init__.py`

- [ ] **Step 1: Create the tools directory and registry**

Create `backend/tools/__init__.py`:

```python
"""Tool registry for agent capabilities."""

TOOL_REGISTRY: dict[str, dict] = {}


def register_tool(name: str, description: str, permission: str, parameters: dict, fn):
    """Register a tool that agents can use.
    
    Args:
        name: Tool name (used in OpenAI function calling)
        description: What the tool does (shown to LLM)
        permission: Required permission category (e.g., "web", "email")
        parameters: JSON Schema for the tool's parameters
        fn: Async callable that executes the tool
    """
    TOOL_REGISTRY[name] = {
        "name": name,
        "description": description,
        "permission": permission,
        "parameters": parameters,
        "fn": fn,
    }


def get_tool(name: str) -> dict | None:
    return TOOL_REGISTRY.get(name)


def get_all_tools() -> list[dict]:
    """Return OpenAI function definitions for all registered tools."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in TOOL_REGISTRY.values()
    ]


def get_tool_permission(name: str) -> str | None:
    tool = TOOL_REGISTRY.get(name)
    return tool["permission"] if tool else None
```

- [ ] **Step 2: Verify imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from tools import register_tool, get_tool, get_all_tools, get_tool_permission; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/tools/
git commit -m "feat: add tool registry for agent capabilities"
```

---

### Task 3: Web research tools

**Files:**
- Create: `backend/tools/web_research.py`

- [ ] **Step 1: Create web research tools**

Create `backend/tools/web_research.py`:

```python
import os
import httpx
from tools import register_tool


async def web_search(query: str, max_results: int = 5) -> str:
    """Search the web using Tavily API."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return "Error: TAVILY_API_KEY not configured"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": True,
            },
            timeout=15.0,
        )

    if response.status_code != 200:
        return f"Search failed with status {response.status_code}"

    data = response.json()
    results = []

    if data.get("answer"):
        results.append(f"Summary: {data['answer']}")

    for r in data.get("results", []):
        results.append(f"- {r['title']}: {r.get('content', '')[:200]} ({r['url']})")

    return "\n".join(results) if results else "No results found."


async def web_fetch(url: str) -> str:
    """Fetch and extract text content from a URL."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            response = await client.get(url, timeout=10.0, headers={"User-Agent": "Sudo/1.0"})
        except Exception as e:
            return f"Failed to fetch URL: {e}"

    if response.status_code != 200:
        return f"Failed to fetch URL: HTTP {response.status_code}"

    text = response.text
    # Basic HTML stripping — extract readable text
    import re
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Truncate to avoid token explosion
    return text[:3000] if len(text) > 3000 else text


def register_web_tools():
    """Register web research tools in the tool registry."""
    register_tool(
        name="web_search",
        description="Search the web for information. Use this when you need to find current information, research topics, or answer questions that require up-to-date knowledge.",
        permission="web",
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Number of results to return (default 5, max 10)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        fn=web_search,
    )

    register_tool(
        name="web_fetch",
        description="Fetch the content of a specific web page. Use this when you need to read the full content of a URL found via search or provided by the user.",
        permission="web",
        parameters={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch",
                },
            },
            "required": ["url"],
        },
        fn=web_fetch,
    )
```

- [ ] **Step 2: Verify imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from tools.web_research import register_web_tools; register_web_tools(); from tools import get_all_tools; print(len(get_all_tools()), 'tools registered')"`

Expected: `2 tools registered`

- [ ] **Step 3: Commit**

```bash
git add backend/tools/web_research.py
git commit -m "feat: add web search and fetch tools using Tavily API"
```

---

### Task 4: Refactor agent.py for function calling

**Files:**
- Modify: `backend/agent.py`

- [ ] **Step 1: Add tool imports and register tools at module load**

Add these imports after the existing imports at the top of `agent.py`:

```python
import json
from tools import get_all_tools, get_tool, get_tool_permission
from tools.web_research import register_web_tools
from permissions import check_permission, consume_permission

# Register all tools
register_web_tools()
```

- [ ] **Step 2: Replace `run_agent_chat` with function-calling version**

Replace the entire `run_agent_chat` function with:

```python
async def run_agent_chat(agent_id: str, user_message: str) -> dict:
    """Run a chat turn for a specific agent. Returns {"reply": str, "tool_calls": list, "permission_requests": list}."""
    agent = await get_agent(agent_id)
    if not agent:
        return {"reply": "Agent not found.", "tool_calls": [], "permission_requests": []}

    system_prompt = agent.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    model = agent.get("model", "gpt-5.4")

    # Inject memories into context
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

    # Function calling loop (max 5 iterations to prevent runaway)
    for _ in range(5):
        response = _get_client().chat.completions.create(
            model=model,
            max_completion_tokens=1000,
            messages=messages,
            tools=tools if tools else None,
        )

        choice = response.choices[0]

        # If no tool calls, we have the final response
        if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
            return {
                "reply": choice.message.content or "",
                "tool_calls": tool_calls_log,
                "permission_requests": permission_requests,
            }

        # Process tool calls
        messages.append(choice.message)

        for tool_call in choice.message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            # Check permission
            required_perm = get_tool_permission(tool_name)
            if required_perm:
                perm_check = await check_permission(agent_id, required_perm,
                    f"Agent wants to use {tool_name}: {json.dumps(tool_args)}")
                if not perm_check["allowed"]:
                    # Permission denied — add to requests and return a tool error
                    permission_requests.append(perm_check.get("request"))
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": f"Permission denied: {required_perm} access not granted. Ask the user to approve.",
                    })
                    tool_calls_log.append({"tool": tool_name, "args": tool_args, "result": "permission_denied"})
                    continue

            # Execute tool
            tool = get_tool(tool_name)
            if not tool:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": f"Unknown tool: {tool_name}",
                })
                continue

            try:
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

            # Consume one-time permission if applicable
            if required_perm:
                await consume_permission(agent_id, required_perm)

    # If we hit the iteration limit, return whatever we have
    return {
        "reply": "I ran into a limit processing your request. Please try again.",
        "tool_calls": tool_calls_log,
        "permission_requests": permission_requests,
    }
```

Note: The return type changed from `str` to `dict` with `reply`, `tool_calls`, and `permission_requests`.

- [ ] **Step 3: Verify imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from agent import run_agent_chat; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: refactor agent chat to use OpenAI function calling with tool registry"
```

---

### Task 5: Update main.py for new agent response format

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update the chat endpoint to handle the new dict response**

Replace the `chat_with_agent` function in `main.py`:

```python
@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await save_agent_message(agent_id, req.user_id, "user", req.message)

    result = await run_agent_chat(agent_id, req.message)

    reply = result["reply"]
    tool_calls = result.get("tool_calls", [])
    perm_requests = result.get("permission_requests", [])

    await save_agent_message(agent_id, req.user_id, "assistant", reply)

    # Extract and save memories (non-critical, don't fail the response)
    try:
        existing = await get_agent_memories(agent_id)
        memories = await extract_memories(req.message, reply, existing)
        for mem in memories:
            await upsert_memory(agent_id, mem["key"], mem["value"])
    except Exception:
        pass

    return {
        "reply": reply,
        "tool_calls": tool_calls,
        "permission_requests": perm_requests,
    }
```

- [ ] **Step 2: Verify server imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: update chat endpoint to return tool calls and permission requests"
```

---

### Task 6: Frontend — Update chat to display tool activity

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/app/(app)/chat/[agentId].tsx`

- [ ] **Step 1: Update chatWithAgent return type in api.ts**

Find the `chatWithAgent` function and update its return type:

```typescript
export async function chatWithAgent(agentId: string, userId: string, message: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json() as Promise<{ reply: string; tool_calls: Array<{ tool: string; args: Record<string, unknown>; result: string }>; permission_requests: unknown[] }>
}
```

- [ ] **Step 2: Update chat screen to show tool activity**

In `src/app/(app)/chat/[agentId].tsx`, update the `handleSend` function. Find the try block where the reply is processed:

```typescript
const { reply } = await chatWithAgent(agentId, userId, text)
```

Replace with:

```typescript
const { reply, tool_calls } = await chatWithAgent(agentId, userId, text)
// Show tool activity before the reply
if (tool_calls && tool_calls.length > 0) {
  const toolSummary = tool_calls.map((tc: { tool: string; args: Record<string, unknown>; result: string }) =>
    `[${tc.tool}] ${tc.result === 'permission_denied' ? 'Permission needed' : 'Done'}`
  ).join('\n')
  const toolMsg: AgentMessage = { role: 'assistant', content: `Tools used:\n${toolSummary}`, created_at: new Date().toISOString() }
  setMessages((prev) => [...prev, toolMsg])
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts src/app/\(app\)/chat/\[agentId\].tsx
git commit -m "feat: display tool activity in chat messages"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Add TAVILY_API_KEY to backend/.env**

Get a key from https://tavily.com and add:
```
TAVILY_API_KEY=tvly-your-key-here
```

- [ ] **Step 2: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -m uvicorn main:app --port 8001`

- [ ] **Step 3: Test web search without permission**

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<USER_ID>", "message": "Search the web for the latest news about AI agents"}'
```

Expected: Response should include a permission request for "web" access (since the agent doesn't have it yet).

- [ ] **Step 4: Grant web permission and retry**

Grant web permission, then retry the search. The agent should now use the web_search tool and return results.

- [ ] **Step 5: Test frontend**

Open chat, ask the agent to search for something. If web permission isn't granted, you'll see a permission card. Grant it, then ask again — the agent should search and show tool activity.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 5A complete — tool framework with web research"
```
