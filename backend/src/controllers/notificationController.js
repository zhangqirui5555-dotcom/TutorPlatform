const notificationService = require("../services/notificationService")

async function getNotifications(req, res) {
  const result = await notificationService.getNotifications(req.user.id, req.query)
  res.json(result)
}

async function getUnreadCount(req, res) {
  const unreadCount = await notificationService.getUnreadCount(req.user.id)
  res.json({ unread_count: unreadCount })
}

async function markRead(req, res) {
  const notification = await notificationService.markRead(
    req.user.id,
    req.params.id,
  )
  res.json({ notification })
}

async function markAllRead(req, res) {
  const result = await notificationService.markAllRead(req.user.id)
  res.json(result)
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
}
