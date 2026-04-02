export const API_URL = __DEV__ ? 'http://localhost:8000' : 'https://your-railway-url.railway.app'

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
