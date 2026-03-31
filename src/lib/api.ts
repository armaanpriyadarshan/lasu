const API_URL = __DEV__ ? 'http://localhost:8000' : 'https://your-railway-url.railway.app'

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
