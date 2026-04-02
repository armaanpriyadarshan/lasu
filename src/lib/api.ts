export const API_URL = __DEV__ ? 'http://localhost:8001' : 'https://your-railway-url.railway.app'

export async function sendMessage(userId: string, content: string, token: string) {
  const res = await fetch(`${API_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, content }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json() as Promise<{ reply: string }>
}

export async function getMessages(userId: string, token: string) {
  const res = await fetch(`${API_URL}/messages/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json() as Promise<{ messages: { role: string; content: string }[] }>
}

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
