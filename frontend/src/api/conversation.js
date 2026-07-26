import client from './client.js'

export async function getConversations() {
  const response = await client.get('/conversations')
  return response.data.conversations
}

export async function getMessages(conversationId) {
  const response = await client.get(`/conversations/${conversationId}/messages`)
  return response.data.messages
}

export async function sendMessage(conversationId, content) {
  const response = await client.post(`/conversations/${conversationId}/messages`, {
    content,
  })
  return response.data.message
}

export async function markRead(conversationId) {
  const response = await client.post(`/conversations/${conversationId}/read`)
  return response.data
}
