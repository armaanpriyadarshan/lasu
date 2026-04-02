export const API_URL = __DEV__ ? 'http://localhost:8000' : 'https://your-railway-url.railway.app'

export async function sendCode(phone: string) {
  const res = await fetch(`${API_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  if (!res.ok) throw new Error('Failed to send code')
  return res.json()
}

export async function verifyCode(phone: string, code: string) {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  })
  if (!res.ok) throw new Error('Invalid code')
  return res.json() as Promise<{ ok: boolean; user_id: string }>
}

export async function getConfig() {
  const res = await fetch(`${API_URL}/config`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json() as Promise<{ sms_number: string }>
}

export async function getMessages(userId: string) {
  const res = await fetch(`${API_URL}/messages/${userId}`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json() as Promise<{ messages: { role: string; content: string }[] }>
}


export async function getUser(userId: string) {
  const res = await fetch(`${API_URL}/users/${userId}`)
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json() as Promise<{
    id: string
    phone_number: string | null
    telegram_chat_id: number | null
  }>
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
