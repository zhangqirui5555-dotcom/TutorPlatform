const conversationService = require("../services/conversationService")

async function getMyConversations(req, res) {
  const conversations = await conversationService.getMyConversations(req.user.id)
  res.json({ conversations })
}

async function getMessages(req, res) {
  const messages = await conversationService.getMessages(req.user.id, req.params.id)
  res.json({ messages })
}

async function sendMessage(req, res) {
  const message = await conversationService.sendMessage(
    req.user.id,
    req.params.id,
    req.body || {},
  )
  res.status(201).json({ message })
}

async function markRead(req, res) {
  const result = await conversationService.markRead(req.user.id, req.params.id)
  res.json(result)
}

module.exports = {
  getMessages,
  getMyConversations,
  markRead,
  sendMessage,
}
