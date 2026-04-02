# Phase 3: Permissions System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deny-by-default permissions system where agents request access inline in chat, users grant one-time or permanently, and permissions are revocable from a settings view.

**Architecture:** Two new tables (`agent_permissions`, `permission_requests`). When an agent needs a capability it doesn't have, the backend creates a permission request returned to the frontend as a special message type. The chat UI renders permission request cards with "Allow once" / "Always allow" buttons. A permissions summary is accessible from the chat header. Tools (Phase 5) will check permissions before executing — this phase builds the infrastructure.

**Tech Stack:** Supabase (PostgreSQL), FastAPI, Expo Router, React Native, TypeScript

**Supabase Project ID:** `imvbbxblyegwmkfdzxmb`

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/db.py` | Add permission CRUD + request CRUD functions |
| `backend/permissions.py` | **New** — permission checking logic, request creation |
| `backend/main.py` | Add permission endpoints (grant, revoke, list, get requests) |
| `backend/models.py` | Add GrantPermissionRequest model |
| `src/lib/api.ts` | Add permission types and API functions |
| `src/app/(app)/chat/[agentId].tsx` | Render permission request cards inline, add permissions summary toggle |

---

### Task 1: Database Migration — Create `agent_permissions` and `permission_requests` tables

**Files:**
- Reference: `backend/db.py`

- [ ] **Step 1: Create both tables via Supabase MCP**

Run this SQL migration against project `imvbbxblyegwmkfdzxmb`:

```sql
CREATE TABLE public.agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  grant_type TEXT NOT NULL DEFAULT 'permanent',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_permissions_agent_id ON public.agent_permissions(agent_id);

ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  grant_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_permission_requests_agent_id ON public.permission_requests(agent_id);

ALTER TABLE public.permission_requests ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('agent_permissions', 'permission_requests') ORDER BY table_name;`

Expected: Two rows.

---

### Task 2: Backend — Permission database operations

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add permission functions to the end of `db.py`**

```python
# ── Permission functions ──

async def get_agent_permissions(agent_id: str) -> list:
    res = (
        supabase.table("agent_permissions")
        .select("*")
        .eq("agent_id", agent_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return res.data


async def has_permission(agent_id: str, permission: str) -> bool:
    res = (
        supabase.table("agent_permissions")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


async def grant_permission(agent_id: str, permission: str, grant_type: str = "permanent") -> dict:
    expires_at = None
    if grant_type == "one_time":
        expires_at = "now()"  # Will be set to actual expiry when used
    res = supabase.table("agent_permissions").insert({
        "agent_id": agent_id,
        "permission": permission,
        "grant_type": grant_type,
    }).execute()
    return res.data[0] if res.data else None


async def revoke_permission(permission_id: str) -> bool:
    res = (
        supabase.table("agent_permissions")
        .update({"revoked_at": "now()"})
        .eq("id", permission_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


async def use_one_time_permission(agent_id: str, permission: str) -> bool:
    """Mark a one-time permission as used (revoke it)."""
    res = (
        supabase.table("agent_permissions")
        .update({"revoked_at": "now()", "expires_at": "now()"})
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .eq("grant_type", "one_time")
        .is_("revoked_at", "null")
        .execute()
    )
    return len(res.data) > 0


# ── Permission request functions ──

async def create_permission_request(agent_id: str, permission: str, reason: str) -> dict:
    # Check if there's already a pending request for this permission
    existing = (
        supabase.table("permission_requests")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("permission", permission)
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        return existing.data[0]

    res = supabase.table("permission_requests").insert({
        "agent_id": agent_id,
        "permission": permission,
        "reason": reason,
    }).execute()
    return res.data[0] if res.data else None


async def get_pending_requests(agent_id: str) -> list:
    res = (
        supabase.table("permission_requests")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


async def resolve_permission_request(request_id: str, status: str, grant_type: str = None) -> dict | None:
    update = {"status": status, "resolved_at": "now()"}
    if grant_type:
        update["grant_type"] = grant_type
    res = (
        supabase.table("permission_requests")
        .update(update)
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )
    return res.data[0] if res.data else None
```

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from db import get_agent_permissions, has_permission, grant_permission, revoke_permission, create_permission_request, get_pending_requests, resolve_permission_request; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/db.py
git commit -m "feat: add permission and request CRUD database operations"
```

---

### Task 3: Backend — Permission checking module

**Files:**
- Create: `backend/permissions.py`

- [ ] **Step 1: Create `permissions.py`**

```python
from db import has_permission, create_permission_request, use_one_time_permission

VALID_PERMISSIONS = {"calendar", "email", "web", "sms", "voice", "contacts", "files"}


async def check_permission(agent_id: str, permission: str, reason: str = "") -> dict:
    """
    Check if an agent has a permission. Returns:
    - {"allowed": True} if the agent has the permission
    - {"allowed": False, "request": {...}} if a permission request was created
    """
    if permission not in VALID_PERMISSIONS:
        return {"allowed": False, "error": f"Unknown permission: {permission}"}

    if await has_permission(agent_id, permission):
        return {"allowed": True}

    # Create a permission request for the user to approve
    request = await create_permission_request(
        agent_id, permission, reason or f"Agent needs {permission} access"
    )
    return {"allowed": False, "request": request}


async def consume_permission(agent_id: str, permission: str):
    """After using a one-time permission, expire it."""
    await use_one_time_permission(agent_id, permission)
```

- [ ] **Step 2: Verify imports work**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from permissions import check_permission, consume_permission; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/permissions.py
git commit -m "feat: add permission checking module"
```

---

### Task 4: Backend — Permission endpoints and models

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add GrantPermissionRequest model to models.py**

Add to the end of `backend/models.py`:

```python
class GrantPermissionRequest(BaseModel):
    grant_type: str  # "one_time" or "permanent"
```

- [ ] **Step 2: Update imports in main.py**

Update the db import to add permission functions:

```python
from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_agent_memories, upsert_memory, delete_memory,
    get_agent_permissions, grant_permission, revoke_permission,
    get_pending_requests, resolve_permission_request,
)
```

Update models import:

```python
from models import MessageRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest, GrantPermissionRequest
```

- [ ] **Step 3: Add permission endpoints at the end of main.py**

```python
# --- Permission endpoints ---

@app.get("/agents/{agent_id}/permissions")
async def get_permissions(agent_id: str):
    permissions = await get_agent_permissions(agent_id)
    return {"permissions": permissions}


@app.get("/agents/{agent_id}/permissions/requests")
async def get_permission_requests(agent_id: str):
    requests = await get_pending_requests(agent_id)
    return {"requests": requests}


@app.post("/agents/{agent_id}/permissions/requests/{request_id}/grant")
async def grant_permission_endpoint(agent_id: str, request_id: str, req: GrantPermissionRequest):
    if req.grant_type not in ("one_time", "permanent"):
        raise HTTPException(status_code=400, detail="grant_type must be 'one_time' or 'permanent'")

    resolved = await resolve_permission_request(request_id, "approved", req.grant_type)
    if not resolved:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")

    perm = await grant_permission(agent_id, resolved["permission"], req.grant_type)
    return perm


@app.post("/agents/{agent_id}/permissions/requests/{request_id}/deny")
async def deny_permission_endpoint(agent_id: str, request_id: str):
    resolved = await resolve_permission_request(request_id, "denied")
    if not resolved:
        raise HTTPException(status_code=404, detail="Request not found or already resolved")
    return {"ok": True}


@app.post("/agents/{agent_id}/permissions/{permission_id}/revoke")
async def revoke_permission_endpoint(agent_id: str, permission_id: str):
    success = await revoke_permission(permission_id)
    if not success:
        raise HTTPException(status_code=404, detail="Permission not found or already revoked")
    return {"ok": True}
```

- [ ] **Step 4: Verify server imports**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -c "from main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add permission grant, deny, revoke, and list endpoints"
```

---

### Task 5: Frontend — Permission API client

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add permission types and API functions to the end of `api.ts`**

```typescript
// ── Permission types ──

export type AgentPermission = {
  id: string
  agent_id: string
  permission: string
  grant_type: 'one_time' | 'permanent'
  granted_at: string
  revoked_at: string | null
  expires_at: string | null
}

export type PermissionRequest = {
  id: string
  agent_id: string
  permission: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  grant_type: string | null
  created_at: string
  resolved_at: string | null
}

// ── Permission API ──

export async function getAgentPermissions(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/permissions`)
  if (!res.ok) throw new Error('Failed to fetch permissions')
  return res.json() as Promise<{ permissions: AgentPermission[] }>
}

export async function getPendingRequests(agentId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/permissions/requests`)
  if (!res.ok) throw new Error('Failed to fetch requests')
  return res.json() as Promise<{ requests: PermissionRequest[] }>
}

export async function grantPermissionRequest(agentId: string, requestId: string, grantType: 'one_time' | 'permanent') {
  const res = await fetch(`${API_URL}/agents/${agentId}/permissions/requests/${requestId}/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: grantType }),
  })
  if (!res.ok) throw new Error('Failed to grant permission')
  return res.json() as Promise<AgentPermission>
}

export async function denyPermissionRequest(agentId: string, requestId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/permissions/requests/${requestId}/deny`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to deny permission')
  return res.json() as Promise<{ ok: boolean }>
}

export async function revokePermission(agentId: string, permissionId: string) {
  const res = await fetch(`${API_URL}/agents/${agentId}/permissions/${permissionId}/revoke`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to revoke permission')
  return res.json() as Promise<{ ok: boolean }>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add permission API client functions"
```

---

### Task 6: Frontend — Permission request cards in chat

**Files:**
- Modify: `src/app/(app)/chat/[agentId].tsx`

- [ ] **Step 1: Update api imports**

Update the import from `@/lib/api` to add permission functions:

```typescript
import {
  getAgent, getAgentMessages, chatWithAgent,
  getAgentMemories, deleteAgentMemory,
  getPendingRequests, grantPermissionRequest, denyPermissionRequest,
  getAgentPermissions, revokePermission,
  type Agent, type AgentMessage, type AgentMemory,
  type PermissionRequest, type AgentPermission,
} from '@/lib/api'
```

- [ ] **Step 2: Add permission state**

After the `showMemory` state, add:

```typescript
const [permRequests, setPermRequests] = useState<PermissionRequest[]>([])
const [permissions, setPermissions] = useState<AgentPermission[]>([])
const [showPermissions, setShowPermissions] = useState(false)
```

- [ ] **Step 3: Load permissions in useFocusEffect**

Update `Promise.all` to also fetch permissions and requests:

```typescript
useFocusEffect(
  useCallback(() => {
    if (!agentId) return
    setLoading(true)
    Promise.all([
      getAgent(agentId),
      getAgentMessages(agentId),
      getAgentMemories(agentId),
      getPendingRequests(agentId),
      getAgentPermissions(agentId),
    ])
      .then(([agentData, { messages }, { memories }, { requests }, { permissions }]) => {
        setAgent(agentData)
        setMessages(messages)
        setMemories(memories)
        setPermRequests(requests)
        setPermissions(permissions)
      })
      .catch(() => router.back())
      .finally(() => setLoading(false))
  }, [agentId])
)
```

- [ ] **Step 4: Add permission handlers**

After `handleDeleteMemory`, add:

```typescript
const handleGrantPermission = async (requestId: string, grantType: 'one_time' | 'permanent') => {
  if (!agentId) return
  try {
    await grantPermissionRequest(agentId, requestId, grantType)
    setPermRequests((prev) => prev.filter((r) => r.id !== requestId))
    // Refresh permissions list
    getAgentPermissions(agentId).then(({ permissions }) => setPermissions(permissions)).catch(() => {})
  } catch {}
}

const handleDenyPermission = async (requestId: string) => {
  if (!agentId) return
  try {
    await denyPermissionRequest(agentId, requestId)
    setPermRequests((prev) => prev.filter((r) => r.id !== requestId))
  } catch {}
}

const handleRevokePermission = async (permissionId: string) => {
  if (!agentId) return
  try {
    await revokePermission(agentId, permissionId)
    setPermissions((prev) => prev.filter((p) => p.id !== permissionId))
  } catch {}
}
```

- [ ] **Step 5: Refresh permission requests after each chat message**

In `handleSend`, after the existing `getAgentMemories` refresh call, add:

```typescript
getPendingRequests(agentId).then(({ requests }) => setPermRequests(requests)).catch(() => {})
```

- [ ] **Step 6: Add permissions toggle to header**

Replace the memory toggle `Pressable` in the header with a row containing both toggles. Replace:

```tsx
<Pressable onPress={() => setShowMemory(!showMemory)} style={styles.backBtn}>
  <ThemedText style={{ color: showMemory ? C.tide : C.pencil, fontSize: 12 }}>
    {memories.length > 0 ? `Memory (${memories.length})` : 'Memory'}
  </ThemedText>
</Pressable>
```

With:

```tsx
<View style={styles.headerRight}>
  <Pressable onPress={() => { setShowPermissions(!showPermissions); setShowMemory(false) }}>
    <ThemedText style={{ color: showPermissions ? C.tide : C.pencil, fontSize: 11 }}>
      {permissions.length > 0 ? `Perms (${permissions.length})` : 'Perms'}
    </ThemedText>
  </Pressable>
  <Pressable onPress={() => { setShowMemory(!showMemory); setShowPermissions(false) }}>
    <ThemedText style={{ color: showMemory ? C.tide : C.pencil, fontSize: 11 }}>
      {memories.length > 0 ? `Memory (${memories.length})` : 'Memory'}
    </ThemedText>
  </Pressable>
</View>
```

- [ ] **Step 7: Add permissions panel**

After the memory panel `</ScrollView>` closing tag and before `{/* Messages */}`, add:

```tsx
{showPermissions && (
  <ScrollView style={styles.memoryPanel}>
    <ThemedText serif style={[styles.memoryTitle, { color: C.ink }]}>
      Permissions
    </ThemedText>
    {permissions.length === 0 ? (
      <ThemedText style={[styles.memoryEmpty, { color: C.pencil }]}>
        No permissions granted yet.
      </ThemedText>
    ) : (
      permissions.map((perm) => (
        <View key={perm.id} style={styles.memoryItem}>
          <View style={styles.memoryContent}>
            <ThemedText style={[styles.memoryKey, { color: C.graphite }]}>
              {perm.permission}
            </ThemedText>
            <ThemedText style={[styles.memoryValue, { color: C.fadedInk }]}>
              {perm.grant_type === 'permanent' ? 'Always allowed' : 'One-time'}
            </ThemedText>
          </View>
          <Pressable onPress={() => handleRevokePermission(perm.id)} style={styles.memoryDelete}>
            <ThemedText style={{ color: C.waxSeal, fontSize: 11 }}>Revoke</ThemedText>
          </Pressable>
        </View>
      ))
    )}
  </ScrollView>
)}
```

- [ ] **Step 8: Add permission request cards before the message input**

Before the `{/* Input */}` comment and the input bar `<View>`, add:

```tsx
{permRequests.length > 0 && (
  <View style={styles.permRequestBar}>
    {permRequests.map((req) => (
      <View key={req.id} style={styles.permRequestCard}>
        <ThemedText style={[styles.permRequestText, { color: C.fadedInk }]}>
          {agent?.name} needs {req.permission} access
        </ThemedText>
        {req.reason ? (
          <ThemedText style={[styles.permRequestReason, { color: C.pencil }]}>
            {req.reason}
          </ThemedText>
        ) : null}
        <View style={styles.permRequestActions}>
          <Pressable
            onPress={() => handleGrantPermission(req.id, 'one_time')}
            style={[styles.permBtn, styles.permBtnOutline]}
          >
            <ThemedText style={[styles.permBtnText, { color: C.ink }]}>Allow once</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleGrantPermission(req.id, 'permanent')}
            style={[styles.permBtn, styles.permBtnFilled]}
          >
            <ThemedText style={[styles.permBtnText, { color: C.white }]}>Always allow</ThemedText>
          </Pressable>
          <Pressable onPress={() => handleDenyPermission(req.id)}>
            <ThemedText style={{ color: C.pencil, fontSize: 12 }}>Deny</ThemedText>
          </Pressable>
        </View>
      </View>
    ))}
  </View>
)}
```

- [ ] **Step 9: Add new styles**

Add to the `StyleSheet.create` object:

```typescript
headerRight: {
  flexDirection: 'row',
  gap: 12,
  alignItems: 'center',
  width: 120,
  justifyContent: 'flex-end',
},
permRequestBar: {
  padding: 12,
  gap: 8,
  backgroundColor: C.agedPaper,
  borderTopWidth: 0.5,
  borderTopColor: C.ruledLine,
},
permRequestCard: {
  backgroundColor: C.parchment,
  borderWidth: 0.5,
  borderColor: C.ruledLine,
  borderRadius: 10,
  padding: 14,
  gap: 8,
},
permRequestText: {
  fontSize: 13,
  fontWeight: '500',
  ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
},
permRequestReason: {
  fontSize: 12,
  ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
},
permRequestActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginTop: 4,
},
permBtn: {
  paddingVertical: 7,
  paddingHorizontal: 14,
  borderRadius: 7,
  ...(isWeb && { cursor: 'pointer' } as any),
},
permBtnOutline: {
  borderWidth: 0.5,
  borderColor: C.ruledLine,
  backgroundColor: C.parchment,
},
permBtnFilled: {
  backgroundColor: C.ink,
},
permBtnText: {
  fontSize: 12,
  fontWeight: '500',
  ...(isWeb && { fontFamily: 'var(--font-display)' } as any),
},
```

- [ ] **Step 10: Commit**

```bash
git add src/app/\(app\)/chat/\[agentId\].tsx
git commit -m "feat: add permission request cards, permissions panel, grant/deny/revoke in chat"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Start the backend**

Run: `cd /c/Users/ezhou/projects/lasu/backend && python -m uvicorn main:app --port 8001`

- [ ] **Step 2: Test permission request creation via API**

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/permissions/requests \
  -H "Content-Type: application/json" \
  -d '{"permission": "calendar", "reason": "Need to check your schedule"}'
```

Note: This endpoint doesn't exist yet — permission requests are created by the `check_permission` function internally. For testing, create one directly in the DB or use the permissions check module.

Alternative test — create a request directly:

```bash
curl -s http://localhost:8001/agents/<AGENT_ID>/permissions/requests
```

Expected: `{"requests": []}`

- [ ] **Step 3: Test granting a permission**

First create a request in Supabase, then grant it:

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/permissions/requests/<REQUEST_ID>/grant \
  -H "Content-Type: application/json" \
  -d '{"grant_type": "permanent"}'
```

- [ ] **Step 4: Test listing permissions**

```bash
curl -s http://localhost:8001/agents/<AGENT_ID>/permissions
```

Expected: `{"permissions": [{"permission": "calendar", "grant_type": "permanent", ...}]}`

- [ ] **Step 5: Test revoking**

```bash
curl -s -X POST http://localhost:8001/agents/<AGENT_ID>/permissions/<PERMISSION_ID>/revoke
```

Expected: `{"ok": true}`

- [ ] **Step 6: Test frontend**

Open `http://localhost:8081`, navigate to an agent's chat:
1. Click "Perms" in header — should show empty state
2. Permission request cards should appear above input when pending requests exist
3. "Allow once" / "Always allow" / "Deny" buttons should work
4. Granted permissions should appear in the Perms panel with "Revoke" buttons

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: Phase 3 complete — deny-by-default permissions with inline grant/revoke"
```
