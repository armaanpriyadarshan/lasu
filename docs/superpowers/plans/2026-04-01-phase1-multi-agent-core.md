# Phase 1: Multi-Agent Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create named AI agents, chat with them individually in-app, and each agent maintains its own conversation history.

**Architecture:** Supabase DB gets an `agents` table + schema modifications to `messages` and `users`. FastAPI backend gets agent CRUD endpoints and a refactored agent runner scoped per-agent. Expo frontend gets an agent list screen, agent creation flow, and per-agent chat screen. Existing SMS/Telegram webhooks are untouched.

**Tech Stack:** Supabase (PostgreSQL), FastAPI, Python, OpenAI API, Expo Router, React Native, TypeScript

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

---

### Task 1: Database Migration — Create `agents` table

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Create `agents` table via Supabase MCP**

Run this SQL migration against project `imvbbxblyegwmkfdzxmb`:

```sql
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'gpt-5.4',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_user_id ON public.agents(user_id);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Verify table exists**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agents' ORDER BY ordinal_position;`

Expected: 9 columns (id, user_id, name, description, system_prompt, model, is_active, created_at, updated_at).

---

### Task 2: Database Migration — Modify `messages` table

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Add `agent_id` and `channel` columns to `messages`**

Run this SQL migration:

```sql
ALTER TABLE public.messages
  ADD COLUMN agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'sms';

CREATE INDEX idx_messages_agent_id ON public.messages(agent_id);
```

`agent_id` is nullable so existing SMS messages (which have no agent) remain valid. `channel` defaults to `'sms'` for existing rows since all current messages came via SMS.

- [ ] **Step 2: Verify columns exist**

Run SQL: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'messages' AND column_name IN ('agent_id', 'channel');`

Expected: Two rows — `agent_id` (uuid, YES) and `channel` (text, NO).

---

### Task 3: Database Migration — Add subscription fields to `users`

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Add `subscription_tier` and `usage_tokens` to `users`**

Run this SQL migration:

```sql
ALTER TABLE public.users
  ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN usage_tokens BIGINT NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Verify columns exist**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('subscription_tier', 'usage_tokens');`

Expected: Two rows.

---

### Task 4: Backend — Agent database operations

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add agent CRUD functions to `db.py`**

Add the following functions to the end of `backend/db.py`:

```python
# ── Agent operations ──

AGENT_LIMITS = {"free": 1, "pro": 5, "enterprise": 25}


async def create_agent(user_id: str, name: str, description: str, system_prompt: str) -> dict:
    user = await get_user_by_id(user_id)
    tier = user.get("subscription_tier", "free") if user else "free"
    limit = AGENT_LIMITS.get(tier, 1)

    existing = supabase.table("agents").select("id").eq("user_id", user_id).eq("is_active", True).execute()
    if len(existing.data) >= limit:
        raise ValueError(f"Agent limit reached ({limit} for {tier} tier)")

    res = supabase.table("agents").insert({
        "user_id": user_id,
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
    }).execute()
    return res.data[0]


async def get_agents(user_id: str) -> list:
    res = (
        supabase.table("agents")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def get_agent(agent_id: str) -> dict | None:
    res = supabase.table("agents").select("*").eq("id", agent_id).eq("is_active", True).execute()
    return res.data[0] if res.data else None


async def update_agent(agent_id: str, updates: dict) -> dict | None:
    updates["updated_at"] = "now()"
    res = supabase.table("agents").update(updates).eq("id", agent_id).eq("is_active", True).execute()
    return res.data[0] if res.data else None


async def delete_agent(agent_id: str) -> bool:
    res = supabase.table("agents").update({"is_active": False, "updated_at": "now()"}).eq("id", agent_id).execute()
    return len(res.data) > 0


async def get_agent_messages(agent_id: str, limit: int = 50) -> list:
    res = (
        supabase.table("messages")
        .select("role, content, created_at")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data))


async def save_agent_message(agent_id: str, user_id: str, role: str, content: str):
    supabase.table("messages").insert({
        "user_id": user_id,
        "agent_id": agent_id,
        "role": role,
        "content": content,
        "channel": "app",
    }).execute()
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "import db; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/db.py
git commit -m "feat: add agent CRUD database operations"
```

---

### Task 5: Backend — Pydantic models for agents

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add agent request/response models**

Add the following to the end of `backend/models.py`:

```python
from typing import Optional


class CreateAgentRequest(BaseModel):
    user_id: str
    name: str
    description: str


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None


class ChatRequest(BaseModel):
    user_id: str
    message: str
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "import models; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add agent Pydantic models"
```

---

### Task 6: Backend — Refactor `agent.py` to be agent-aware

**Files:**
- Modify: `backend/agent.py`

- [ ] **Step 1: Rewrite `agent.py` to support per-agent context**

Replace the entire contents of `backend/agent.py` with:

```python
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
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "import agent; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/agent.py
git commit -m "feat: refactor agent.py for per-agent context and system prompt generation"
```

---

### Task 7: Backend — Agent API endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add agent imports to `main.py`**

In `backend/main.py`, update the import block from `db` (line 14-18) to:

```python
from db import (
    get_user_by_phone, create_user, mark_user_verified, save_message,
    get_recent_messages, create_telegram_user, get_user_by_telegram,
    link_telegram, get_user_by_id,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
)
from agent import run_agent, run_agent_chat, generate_system_prompt
```

Also update the models import (line 22):

```python
from models import PhoneRequest, VerifyRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest
```

- [ ] **Step 2: Add agent CRUD endpoints**

Add the following endpoints to `backend/main.py`, before the `# --- User info ---` section (before line 156):

```python
# --- Agent endpoints ---

@app.post("/agents")
async def create_agent_endpoint(req: CreateAgentRequest):
    system_prompt = await generate_system_prompt(req.description)
    try:
        agent = await create_agent(req.user_id, req.name, req.description, system_prompt)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return agent


@app.get("/agents")
async def list_agents(user_id: str):
    agents = await get_agents(user_id)
    return {"agents": agents}


@app.get("/agents/{agent_id}")
async def get_agent_endpoint(agent_id: str):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch("/agents/{agent_id}")
async def update_agent_endpoint(agent_id: str, req: UpdateAgentRequest):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    agent = await update_agent(agent_id, updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.delete("/agents/{agent_id}")
async def delete_agent_endpoint(agent_id: str):
    success = await delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"ok": True}


@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await save_agent_message(agent_id, req.user_id, "user", req.message)

    reply = await run_agent_chat(agent_id, req.message)

    await save_agent_message(agent_id, req.user_id, "assistant", reply)

    return {"reply": reply}


@app.get("/agents/{agent_id}/messages")
async def get_agent_messages_endpoint(agent_id: str, limit: int = 50):
    messages = await get_agent_messages(agent_id, limit)
    return {"messages": messages}
```

- [ ] **Step 3: Verify server starts**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add agent CRUD and chat API endpoints"
```

---

### Task 8: Frontend — API client functions for agents

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add agent API functions**

Add the following to the end of `src/lib/api.ts`:

```typescript
// ── Agent types ──

export type Agent = {
  id: string
  user_id: string
  name: string
  description: string
  system_prompt: string
  model: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AgentMessage = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ── Agent API ──

export async function createAgent(userId: string, name: string, description: string) {
  const res = await fetch(`${API_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, name, description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create agent' }))
    throw new Error(err.detail)
  }
  return res.json() as Promise<Agent>
}

export async function listAgents(userId: string) {
  const res = await fetch(`${API_URL}/agents?user_id=${userId}`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json() as Promise<{ agents: Agent[] }>
}

export async function getAgent(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}`)
  if (!res.ok) throw new Error('Failed to fetch agent')
  return res.json() as Promise<Agent>
}

export async function updateAgent(agentId: string, updates: { name?: string; description?: string; system_prompt?: string }) {
  const res = await fetch(`${API_URL}/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update agent')
  return res.json() as Promise<Agent>
}

export async function deleteAgent(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete agent')
  return res.json() as Promise<{ ok: boolean }>
}

export async function chatWithAgent(agentId: string, userId: string, message: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json() as Promise<{ reply: string }>
}

export async function getAgentMessages(agentId: string, limit = 50) {
  const res = await fetch(`${API_URL}/agents/${agentId}/messages?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json() as Promise<{ messages: AgentMessage[] }>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add agent API client functions"
```

---

### Task 9: Frontend — Agent list screen

**Files:**
- Create: `src/app/(app)/agents.tsx`

- [ ] **Step 1: Create the agents list screen**

Create `src/app/(app)/agents.tsx`:

```tsx
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { listAgents, createAgent, type Agent } from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function AgentsScreen() {
  const { userId } = useAuth()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isDesktop = width > 768

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      setLoading(true)
      listAgents(userId)
        .then(({ agents }) => setAgents(agents))
        .catch(() => {})
        .finally(() => setLoading(false))
    }, [userId])
  )

  const handleCreate = async () => {
    if (!userId || !name.trim() || !description.trim()) return
    setCreating(true)
    setError('')
    try {
      const agent = await createAgent(userId, name.trim(), description.trim())
      setShowCreate(false)
      setName('')
      setDescription('')
      router.push(`/chat/${agent.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.pencil} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesk]}
    >
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <ThemedText serif style={[styles.title, { color: C.ink }]}>
          Your agents
        </ThemedText>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.7 }]}
        >
          <ThemedText style={[styles.createBtnText, { color: C.white }]}>
            + Create agent
          </ThemedText>
        </Pressable>
      </Animated.View>

      {showCreate && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.createForm}>
          <TextInput
            placeholder="Agent name"
            placeholderTextColor={C.pencil}
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: C.ink, borderColor: C.ruledLine }]}
          />
          <TextInput
            placeholder="What should this agent do?"
            placeholderTextColor={C.pencil}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.inputMulti, { color: C.ink, borderColor: C.ruledLine }]}
          />
          {error ? (
            <ThemedText style={[styles.errorText, { color: C.errorText }]}>{error}</ThemedText>
          ) : null}
          <View style={styles.createActions}>
            <Pressable
              onPress={() => { setShowCreate(false); setError('') }}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <ThemedText style={{ color: C.pencil }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={creating || !name.trim() || !description.trim()}
              style={({ pressed }) => [
                styles.submitBtn,
                (creating || !name.trim() || !description.trim()) && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {creating ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <ThemedText style={[styles.submitBtnText, { color: C.white }]}>Create</ThemedText>
              )}
            </Pressable>
          </View>
        </Animated.View>
      )}

      {agents.length === 0 && !showCreate ? (
        <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.empty}>
          <ThemedText serif style={[styles.emptyTitle, { color: C.fadedInk }]}>
            No agents yet
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: C.pencil }]}>
            Create your first agent to get started.
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={[styles.agentGrid, isDesktop && styles.agentGridDesk]}>
          {agents.map((agent, i) => (
            <Pressable
              key={agent.id}
              onPress={() => router.push(`/chat/${agent.id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <Animated.View
                entering={FadeInDown.duration(300).delay(i * 80)}
                style={styles.agentCard}
              >
                <View style={styles.agentAvatar}>
                  <ThemedText style={[styles.agentInitial, { color: C.white }]}>
                    {agent.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.agentInfo}>
                  <ThemedText style={[styles.agentName, { color: C.ink }]}>
                    {agent.name}
                  </ThemedText>
                  <ThemedText
                    numberOfLines={2}
                    style={[styles.agentDesc, { color: C.pencil }]}
                  >
                    {agent.description}
                  </ThemedText>
                </View>
              </Animated.View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.parchment },
  pageContent: { padding: 24, paddingBottom: 80 },
  pageContentDesk: { padding: 28, paddingHorizontal: 32, maxWidth: 960 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  createBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  createForm: {
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  input: {
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 12 },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, ...(isWeb && { cursor: 'pointer' } as any) },
  submitBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  submitBtnText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  emptyText: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  agentGrid: { gap: 12 },
  agentGridDesk: { flexDirection: 'row', flexWrap: 'wrap' },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderRadius: 10,
    padding: 16,
    ...(isWeb && { cursor: 'pointer', transition: 'border-color 150ms ease', minWidth: 280 } as any),
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.tide,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: { fontSize: 16, fontWeight: '600' },
  agentInfo: { flex: 1, gap: 4 },
  agentName: {
    fontSize: 15,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
  agentDesc: {
    fontSize: 12,
    lineHeight: 18,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/agents.tsx
git commit -m "feat: add agent list screen with create agent form"
```

---

### Task 10: Frontend — Per-agent chat screen

**Files:**
- Create: `src/app/(app)/chat/[agentId].tsx`

- [ ] **Step 1: Create the chat directory**

Run: `mkdir -p /c/Users/ezhou/projects/lasu/src/app/\(app\)/chat`

- [ ] **Step 2: Create the per-agent chat screen**

Create `src/app/(app)/chat/[agentId].tsx`:

```tsx
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeIn } from 'react-native-reanimated'

import { ThemedText } from '@/components/themed-text'
import { Colors } from '@/constants/theme'
import { useAuth } from '@/lib/auth'
import { getAgent, getAgentMessages, chatWithAgent, type Agent, type AgentMessage } from '@/lib/api'

const C = Colors.light
const isWeb = Platform.OS === 'web'

export default function ChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>()
  const { userId } = useAuth()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!agentId) return
      setLoading(true)
      Promise.all([
        getAgent(agentId),
        getAgentMessages(agentId),
      ])
        .then(([agentData, { messages }]) => {
          setAgent(agentData)
          setMessages(messages)
        })
        .catch(() => router.back())
        .finally(() => setLoading(false))
    }, [agentId])
  )

  const handleSend = async () => {
    if (!userId || !agentId || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    const userMsg: AgentMessage = { role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])

    try {
      const { reply } = await chatWithAgent(agentId, userId, text)
      const assistantMsg: AgentMessage = { role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      const errMsg: AgentMessage = { role: 'assistant', content: 'Something went wrong. Try again.', created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.pencil} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.chatHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={{ color: C.pencil, fontSize: 14 }}>{'< Back'}</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <ThemedText style={[styles.headerInitial, { color: C.white }]}>
              {agent?.name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText style={[styles.headerName, { color: C.ink }]}>
            {agent?.name}
          </ThemedText>
        </View>
        <View style={styles.backBtn} />
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <ThemedText serif style={[styles.emptyChatTitle, { color: C.fadedInk }]}>
              Start a conversation
            </ThemedText>
            <ThemedText style={[styles.emptyChatText, { color: C.pencil }]}>
              Say hello to {agent?.name}.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAgent,
            ]}
          >
            <ThemedText
              style={[
                styles.bubbleText,
                { color: item.role === 'user' ? C.white : C.fadedInk },
              ]}
            >
              {item.content}
            </ThemedText>
          </View>
        )}
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          placeholder={`Message ${agent?.name ?? 'agent'}...`}
          placeholderTextColor={C.pencil}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
          style={[styles.textInput, { color: C.ink, borderColor: C.ruledLine }]}
        />
        <Pressable
          onPress={handleSend}
          disabled={sending || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (sending || !input.trim()) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <ThemedText style={[styles.sendBtnText, { color: C.white }]}>Send</ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.parchment },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.agedPaper,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ruledLine,
  },
  backBtn: { width: 60 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.tide,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitial: { fontSize: 14, fontWeight: '600' },
  headerName: {
    fontSize: 16,
    fontWeight: '500',
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  emptyChat: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: '400',
    ...(isWeb && { fontFamily: 'var(--font-serif)' } as any),
  },
  emptyChatText: {
    fontSize: 13,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: C.ink,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: C.agedPaper,
    borderWidth: 0.5,
    borderColor: C.ruledLine,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: C.agedPaper,
    borderTopWidth: 0.5,
    borderTopColor: C.ruledLine,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.parchment,
    borderWidth: 0.5,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    ...(isWeb && { fontFamily: 'var(--font-display)', outlineStyle: 'none' } as any),
  },
  sendBtn: {
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    ...(isWeb && { cursor: 'pointer' } as any),
  },
  sendBtnText: { fontSize: 13, fontWeight: '500' },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/chat/
git commit -m "feat: add per-agent chat screen with message bubbles"
```

---

### Task 11: Frontend — Wire navigation to agents screen

**Files:**
- Modify: `src/app/(app)/_layout.tsx`

- [ ] **Step 1: Update sidebar navigation to route to agents screen**

In `src/app/(app)/_layout.tsx`, update the `NAV_ITEMS` array (around line 30-36) to add agents and make items routable:

```typescript
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'dashboard', icon: 'grid' },
  { key: 'agents', label: 'agents', icon: 'star' },
  { key: 'channels', label: 'channels', icon: 'globe' },
  { key: 'memory', label: 'memory', icon: 'bookmark' },
  { key: 'settings', label: 'settings', icon: 'gear' },
]
```

- [ ] **Step 2: Make nav items route on press**

In the sidebar nav section (around line 168-194), add `onPress` to the desktop `Pressable`:

```tsx
<Pressable
  key={item.key}
  onPress={() => {
    if (item.key === 'dashboard') router.push('/(app)')
    else router.push(`/(app)/${item.key}`)
  }}
  dataSet={!active ? { hover: 'vellum' } : undefined}
  style={({ pressed }) => [
    styles.navItem,
    active && styles.navItemActive,
    pressed && !active && styles.navItemHover,
  ]}
>
```

- [ ] **Step 3: Do the same for mobile tab bar** (around line 227-249)

Update the mobile tab `Pressable` to include `onPress`:

```tsx
<Pressable
  key={item.key}
  onPress={() => {
    if (item.key === 'dashboard') router.push('/(app)')
    else router.push(`/(app)/${item.key}`)
  }}
  style={({ pressed }) => [
    styles.tab,
    pressed && { opacity: 0.5 },
  ]}
>
```

- [ ] **Step 4: Update activeKey detection to handle agents and chat routes**

Replace the `activeKey` line (around line 150):

```typescript
const activeKey = (() => {
  if (pathname === '/' || pathname === '/(app)') return 'dashboard'
  if (pathname.startsWith('/chat/') || pathname.startsWith('/(app)/chat/')) return 'agents'
  const segment = pathname.replace('/(app)/', '').replace('/', '')
  return segment || 'dashboard'
})()
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/_layout.tsx
git commit -m "feat: wire sidebar and tab navigation to agents screen"
```

---

### Task 12: Frontend — Update dashboard with real agent data

**Files:**
- Modify: `src/app/(app)/index.tsx`

- [ ] **Step 1: Import agent API and auth**

Add imports at the top of `src/app/(app)/index.tsx`:

```typescript
import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { listAgents, type Agent } from '@/lib/api'
```

Remove the standalone `import React from 'react'` line (line 1) since `React` is imported implicitly in React 19.

- [ ] **Step 2: Add state and data fetching to DashboardScreen**

At the top of the `DashboardScreen` component, add:

```typescript
export default function DashboardScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width > 768
  const { userId } = useAuth()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      listAgents(userId)
        .then(({ agents }) => setAgents(agents))
        .catch(() => {})
    }, [userId])
  )
```

- [ ] **Step 3: Replace mock "Active channels" stat with real agent count**

Update the `STATS` array to be dynamic. Replace the static `STATS` constant and the stat cards section with:

```typescript
const stats = [
  { label: 'Messages today', value: '—', subtitle: 'Coming soon', positive: false },
  { label: 'Active agents', value: String(agents.length), subtitle: agents.length === 0 ? 'Create your first' : 'Running', positive: agents.length > 0 },
  { label: 'Skills running', value: '0', subtitle: 'Coming soon', positive: false },
]
```

And update the JSX to use `stats` instead of `STATS`:

```tsx
{stats.map((stat, i) => (
  <StatCard key={stat.label} {...stat} index={i} />
))}
```

- [ ] **Step 4: Add quick-nav to agents from dashboard**

Below the channel pills section, add an agents quick-nav:

```tsx
{agents.length > 0 && (
  <View style={styles.channelSection}>
    {agents.map((a) => (
      <Pressable
        key={a.id}
        onPress={() => router.push(`/chat/${a.id}`)}
        style={styles.channelPill}
      >
        <View style={[styles.channelDot, { backgroundColor: C.tide }]} />
        <ThemedText style={[styles.channelText, { color: C.fadedInk }]}>
          {a.name}
        </ThemedText>
      </Pressable>
    ))}
  </View>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/index.tsx
git commit -m "feat: update dashboard with real agent count and quick-nav"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && uvicorn main:app --reload --port 8000`

Verify: Server starts without errors.

- [ ] **Step 2: Test agent creation via API**

Run:
```bash
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<YOUR_USER_ID>", "name": "Atlas", "description": "A research assistant that helps me find information and summarize articles"}'
```

Expected: JSON response with agent `id`, `name`, `system_prompt` (LLM-generated), etc.

- [ ] **Step 3: Test agent listing**

Run: `curl http://localhost:8000/agents?user_id=<YOUR_USER_ID>`

Expected: `{"agents": [{ ... Atlas agent ... }]}`

- [ ] **Step 4: Test chat**

Run:
```bash
curl -X POST http://localhost:8000/agents/<AGENT_ID>/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<YOUR_USER_ID>", "message": "Hello, what can you help me with?"}'
```

Expected: `{"reply": "..."}` with a response reflecting the agent's generated system prompt.

- [ ] **Step 5: Test message history**

Run: `curl http://localhost:8000/agents/<AGENT_ID>/messages`

Expected: `{"messages": [{"role": "user", ...}, {"role": "assistant", ...}]}`

- [ ] **Step 6: Start the frontend**

Run: `cd /c/Users/ezhou/projects/lasu && npx expo start --web`

Verify:
1. Dashboard shows real agent count under "Active agents"
2. Clicking "agents" in sidebar navigates to agents screen
3. "Create agent" form works — agent appears in list
4. Clicking agent opens chat screen
5. Sending a message returns an agent response
6. Messages persist on page reload

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — multi-agent core with CRUD, chat, and navigation"
```
