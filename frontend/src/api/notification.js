import client from './client.js'

export async function getNotifications(params = {}) {
  const response = await client.get('/notifications', { params })
  return response.data
}

export async function getUnreadCount() {
  const response = await client.get('/notifications/unread-count')
  return response.data.unread_count
}

export async function markNotificationRead(notificationId) {
  const response = await client.patch(`/notifications/${notificationId}/read`)
  return response.data.notification
}

export async function markAllNotificationsRead() {
  const response = await client.patch('/notifications/read-all')
  return response.data
}
