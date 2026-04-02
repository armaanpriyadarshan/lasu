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
