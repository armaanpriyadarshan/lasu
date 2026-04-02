# Phase 2: Agent Memory & Learning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents remember facts and preferences about the user across conversations, getting smarter over time. Users can view and delete memories from the agent profile.

**Architecture:** After each chat turn, a lightweight LLM call extracts facts/preferences from the conversation. These are stored in an `agent_memory` table and injected into the agent's system prompt context before each response. The frontend gets a memory tab on the agent profile. Memory extraction runs asynchronously after the response is sent (non-blocking).

**Tech Stack:** Supabase (PostgreSQL), FastAPI, OpenAI API, Expo Router, React Native, TypeScript

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/db.py` | Add memory CRUD functions (save, get, delete, upsert) |
| `backend/memory.py` | **New** — memory extraction logic (LLM call to extract facts from conversation) |
| `backend/agent.py` | Inject memories into agent context before each response |
| `backend/main.py` | Add memory endpoints + wire extraction into chat flow |
| `backend/models.py` | No changes needed (memory endpoints use path params only) |
| `src/lib/api.ts` | Add memory types and API functions |
| `src/app/(app)/chat/[agentId].tsx` | Add memory tab/drawer accessible from chat header |

---

### Task 1: Database Migration — Create `agent_memory` table

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Create `agent_memory` table via Supabase MCP**

Run this SQL migration against project `imvbbxblyegwmkfdzxmb`:

```sql
CREATE TABLE public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'extracted',
  confidence FLOAT NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_agent_id ON public.agent_memory(agent_id);
CREATE UNIQUE INDEX idx_agent_memory_agent_key ON public.agent_memory(agent_id, key);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
```

The unique index on `(agent_id, key)` enables upsert — if a memory with the same key exists, it gets updated rather than duplicated.

- [ ] **Step 2: Verify table exists**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_memory' ORDER BY ordinal_position;`

Expected: 8 columns (id, agent_id, key, value, source, confidence, created_at, updated_at).

---

### Task 2: Backend — Memory database operations

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add memory functions to the end of `db.py`**

```python
# ── Memory functions ──

async def get_agent_memories(agent_id: str) -> list:
    res = (
        supabase.table("agent_memory")
        .select("*")
        .eq("agent_id", agent_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return res.data


async def upsert_memory(agent_id: str, key: str, value: str, source: str = "extracted", confidence: float = 0.8):
    res = (
        supabase.table("agent_memory")
        .upsert(
            {
                "agent_id": agent_id,
                "key": key,
                "value": value,
                "source": source,
                "confidence": confidence,
                "updated_at": "now()",
            },
            on_conflict="agent_id,key",
        )
        .execute()
    )
    return res.data[0] if res.data else None


async def delete_memory(memory_id: str) -> bool:
    res = supabase.table("agent_memory").delete().eq("id", memory_id).execute()
    return len(res.data) > 0
```

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from db import get_agent_memories, upsert_memory, delete_memory; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/db.py
git commit -m "feat: add agent memory CRUD database operations"
```

---

### Task 3: Backend — Memory extraction module

**Files:**
- Create: `backend/memory.py`

- [ ] **Step 1: Create `memory.py`**

```python
import json
import os
from openai import OpenAI


def _get_client():
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


EXTRACTION_PROMPT = """You are a memory extraction system. Given a conversation between a user and an AI agent, extract facts and preferences about the user that would be useful to remember for future conversations.

Rules:
- Only extract facts the USER stated or clearly implied (not the agent's suggestions)
- Each fact should have a short key (snake_case, max 30 chars) and a value (the fact itself)
- Skip trivial or one-time facts (e.g., "user said hello")
- Focus on: preferences, habits, personal info, work context, relationships, goals
- If the user corrects a previous statement, extract the correction
- Return an empty array if nothing worth remembering was said

Return ONLY valid JSON in this format:
[{"key": "preferred_name", "value": "Goes by Alex"}, {"key": "work_role", "value": "Senior engineer at Stripe"}]

If nothing worth remembering: []"""


async def extract_memories(user_message: str, agent_reply: str) -> list[dict]:
    """Extract memorable facts from a conversation turn. Returns list of {key, value} dicts."""
    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        max_completion_tokens=300,
        temperature=0,
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": f"User said: {user_message}\n\nAgent replied: {agent_reply}"},
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
```

Note: Uses `gpt-4o-mini` for extraction (cheap, fast) rather than the agent's main model.

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from memory import extract_memories; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/memory.py
git commit -m "feat: add memory extraction module with LLM-based fact extraction"
```

---

### Task 4: Backend — Inject memories into agent context

**Files:**
- Modify: `backend/agent.py`

- [ ] **Step 1: Update imports in `agent.py`**

Add `get_agent_memories` to the import from db (line 3):

```python
from db import get_agent_messages, get_agent, get_agent_memories
```

- [ ] **Step 2: Update `run_agent_chat` to inject memories**

Replace the `run_agent_chat` function with:

```python
async def run_agent_chat(agent_id: str, user_message: str) -> str:
    """Run a chat turn for a specific agent."""
    agent = await get_agent(agent_id)
    if not agent:
        return "Agent not found."

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

    response = _get_client().chat.completions.create(
        model=model,
        max_completion_tokens=1000,
        messages=messages,
    )

    return response.choices[0].message.content
```

- [ ] **Step 3: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from agent import run_agent_chat; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: inject agent memories into system prompt context"
```

---

### Task 5: Backend — Wire memory extraction into chat + add memory endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update imports in `main.py`**

Update the db import (line 9-12) to add memory functions:

```python
from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_agent_memories, upsert_memory, delete_memory,
)
```

Add the memory extraction import after the agent import (line 14):

```python
from agent import run_agent, run_agent_chat, generate_system_prompt
from memory import extract_memories
```

- [ ] **Step 2: Update the chat endpoint to extract memories after each turn**

Replace the `chat_with_agent` function:

```python
@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await save_agent_message(agent_id, req.user_id, "user", req.message)

    reply = await run_agent_chat(agent_id, req.message)

    await save_agent_message(agent_id, req.user_id, "assistant", reply)

    # Extract and save memories (non-critical, don't fail the response)
    try:
        memories = await extract_memories(req.message, reply)
        for mem in memories:
            await upsert_memory(agent_id, mem["key"], mem["value"])
    except Exception:
        pass

    return {"reply": reply}
```

- [ ] **Step 3: Add memory endpoints**

Add these endpoints after the existing agent endpoints, before the end of the file:

```python
# --- Memory endpoints ---

@app.get("/agents/{agent_id}/memory")
async def get_memories(agent_id: str):
    memories = await get_agent_memories(agent_id)
    return {"memories": memories}


@app.delete("/agents/{agent_id}/memory/{memory_id}")
async def delete_memory_endpoint(agent_id: str, memory_id: str):
    success = await delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}
```

- [ ] **Step 4: Verify server imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: wire memory extraction into chat flow and add memory endpoints"
```

---

### Task 6: Frontend — Memory API client functions

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add memory types and API functions to the end of `api.ts`**

```typescript
// ── Memory types ──

export type AgentMemory = {
  id: string
  agent_id: string
  key: string
  value: string
  source: string
  confidence: number
  created_at: string
  updated_at: string
}

// ── Memory API ──

export async function getAgentMemories(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/memory`)
  if (!res.ok) throw new Error('Failed to fetch memories')
  return res.json() as Promise<{ memories: AgentMemory[] }>
}

export async function deleteAgentMemory(agentId: string, memoryId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/memory/${memoryId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete memory')
  return res.json() as Promise<{ ok: boolean }>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add memory API client functions"
```

---

### Task 7: Frontend — Memory tab on chat screen

**Files:**
- Modify: `src/app/(app)/chat/[agentId].tsx`

- [ ] **Step 1: Add memory imports**

At the top of the file, update the api import to add memory functions:

```typescript
import { getAgent, getAgentMessages, chatWithAgent, getAgentMemories, deleteAgentMemory, type Agent, type AgentMessage, type AgentMemory } from '@/lib/api'
```

- [ ] **Step 2: Add memory state and toggle**

Inside the `ChatScreen` component, after the existing state declarations (after `const [sending, setSending] = useState(false)`), add:

```typescript
const [memories, setMemories] = useState<AgentMemory[]>([])
const [showMemory, setShowMemory] = useState(false)
```

- [ ] **Step 3: Load memories in the useFocusEffect**

Update the existing `useFocusEffect` to also load memories. Replace the `Promise.all` block:

```typescript
useFocusEffect(
  useCallback(() => {
    if (!agentId) return
    setLoading(true)
    Promise.all([
      getAgent(agentId),
      getAgentMessages(agentId),
      getAgentMemories(agentId),
    ])
      .then(([agentData, { messages }, { memories }]) => {
        setAgent(agentData)
        setMessages(messages)
        setMemories(memories)
      })
      .catch(() => router.back())
      .finally(() => setLoading(false))
  }, [agentId])
)
```

- [ ] **Step 4: Add memory deletion handler**

After the `handleSend` function, add:

```typescript
const handleDeleteMemory = async (memoryId: string) => {
  if (!agentId) return
  await deleteAgentMemory(agentId, memoryId).catch(() => {})
  setMemories((prev) => prev.filter((m) => m.id !== memoryId))
}
```

- [ ] **Step 5: Add memory toggle button to the chat header**

Replace the empty `<View style={styles.backBtn} />` spacer at the end of the header with:

```tsx
<Pressable onPress={() => setShowMemory(!showMemory)} style={styles.backBtn}>
  <ThemedText style={{ color: showMemory ? C.tide : C.pencil, fontSize: 12 }}>
    {memories.length > 0 ? `Memory (${memories.length})` : 'Memory'}
  </ThemedText>
</Pressable>
```

- [ ] **Step 6: Add memory panel between header and messages**

After the closing `</Animated.View>` of the chat header and before the `<FlatList`, add:

```tsx
{showMemory && (
  <View style={styles.memoryPanel}>
    <ThemedText serif style={[styles.memoryTitle, { color: C.ink }]}>
      What {agent?.name} remembers
    </ThemedText>
    {memories.length === 0 ? (
      <ThemedText style={[styles.memoryEmpty, { color: C.pencil }]}>
        No memories yet. Chat more and {agent?.name} will learn about you.
      </ThemedText>
    ) : (
      memories.map((mem) => (
        <View key={mem.id} style={styles.memoryItem}>
          <View style={styles.memoryContent}>
            <ThemedText style={[styles.memoryKey, { color: C.graphite }]}>
              {mem.key.replace(/_/g, ' ')}
            </ThemedText>
            <ThemedText style={[styles.memoryValue, { color: C.fadedInk }]}>
              {mem.value}
            </ThemedText>
          </View>
          <Pressable onPress={() => handleDeleteMemory(mem.id)} style={styles.memoryDelete}>
            <ThemedText style={{ color: C.pencil, fontSize: 12 }}>x</ThemedText>
          </Pressable>
        </View>
      ))
    )}
  </View>
)}
```

- [ ] **Step 7: Add memory styles**

Add these to the `StyleSheet.create({...})` object:

```typescript
memoryPanel: {
  backgroundColor: C.agedPaper,
  borderBottomWidth: 0.5,
  borderBottomColor: C.ruledLine,
  padding: 16,
  maxHeight: 250,
},
memoryTitle: {
  fontSize: 16,
  fontWeight: '400',
  marginBottom: 12,
  ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
},
memoryEmpty: {
  fontSize: 13,
  ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
},
memoryItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 8,
  borderBottomWidth: 0.5,
  borderBottomColor: C.ruledLine,
},
memoryContent: { flex: 1, gap: 2 },
memoryKey: {
  fontSize: 11,
  fontWeight: '500',
  textTransform: 'uppercase',
  ...(isWeb && { fontFamily: 'var(--font-mono)' } as any),
},
memoryValue: {
  fontSize: 13,
  ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
},
memoryDelete: {
  padding: 8,
  ...(isWeb && { cursor: 'pointer' } as any),
},
```

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/chat/\[agentId\].tsx
git commit -m "feat: add memory panel to chat screen with view and delete"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -m uvicorn main:app --port 8001`

Verify: Server starts without errors.

- [ ] **Step 2: Test memory extraction via API**

Have a conversation that mentions a preference:

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<USER_ID>", "message": "Hey, just so you know, I prefer morning meetings and my name is Ethan"}'
```

Then check memories were extracted:

```bash
curl -s http://localhost:8001/agents/<AGENT_ID>/memory
```

Expected: `{"memories": [{"key": "preferred_name", "value": "Ethan", ...}, {"key": "meeting_preference", "value": "Prefers morning meetings", ...}]}`

- [ ] **Step 3: Test memory injection**

Send another message:

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<USER_ID>", "message": "When should we schedule the next meeting?"}'
```

Expected: Agent's reply should reference the morning preference without being reminded.

- [ ] **Step 4: Test memory deletion**

```bash
curl -s -X DELETE http://localhost:8001/agents/<AGENT_ID>/memory/<MEMORY_ID>
```

Expected: `{"ok": true}`

- [ ] **Step 5: Test frontend**

Open `http://localhost:8081`, navigate to an agent's chat:
1. Send messages mentioning preferences
2. Click "Memory" in chat header — should show extracted facts
3. Delete a memory — should disappear from list
4. Send a new message — agent should reference remaining memories

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 2 complete — agent memory extraction, injection, and management"
```
