const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toNotificationResponse = require("../utils/notificationResponse")

const MAX_PAGE_SIZE = 50
const ACTOR_INCLUDE = {
  actor: {
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  },
}

function requirePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      400,
      `INVALID_${fieldName.toUpperCase()}`,
      `${fieldName} must be a positive integer`,
    )
  }

  return parsed
}

function optionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null) {
    return null
  }

  return requirePositiveInteger(value, fieldName)
}

function requireText(value, fieldName, maximumLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      400,
      `INVALID_NOTIFICATION_${fieldName.toUpperCase()}`,
      `${fieldName} is required`,
    )
  }

  const text = value.trim()
  if (text.length > maximumLength) {
    throw new AppError(
      400,
      `INVALID_NOTIFICATION_${fieldName.toUpperCase()}`,
      `${fieldName} cannot exceed ${maximumLength} characters`,
    )
  }

  return text
}

function optionalText(value, fieldName, maximumLength) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      `INVALID_NOTIFICATION_${fieldName.toUpperCase()}`,
      `${fieldName} must be a string`,
    )
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  if (text.length > maximumLength) {
    throw new AppError(
      400,
      `INVALID_NOTIFICATION_${fieldName.toUpperCase()}`,
      `${fieldName} cannot exceed ${maximumLength} characters`,
    )
  }

  return text
}

function parsePagination(query = {}) {
  const page = query.page === undefined
    ? 1
    : requirePositiveInteger(query.page, "page")
  const pageSize = query.page_size === undefined
    ? 20
    : requirePositiveInteger(query.page_size, "page_size")

  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(
      400,
      "INVALID_PAGE_SIZE",
      `page_size must be an integer between 1 and ${MAX_PAGE_SIZE}`,
    )
  }

  return { page, pageSize }
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new AppError(400, "INVALID_NOTIFICATION_EVENT", "event is required")
  }

  const recipientId = requirePositiveInteger(event.recipientId, "recipient_id")
  const actorId = optionalPositiveInteger(event.actorId, "actor_id")
  const eventKey = requireText(event.eventKey, "event_key", 255)
  const type = requireText(event.type, "type", 100).toUpperCase()
  const title = requireText(event.title, "title", 200)
  const body = requireText(event.body, "body", 2000)
  const resourceType = optionalText(event.resourceType, "resource_type", 100)
    ?.toUpperCase() || null
  const resourceId = optionalPositiveInteger(event.resourceId, "resource_id")
  const actionPath = optionalText(event.actionPath, "action_path", 500)

  if ((resourceType === null) !== (resourceId === null)) {
    throw new AppError(
      400,
      "INVALID_NOTIFICATION_RESOURCE",
      "resourceType and resourceId must be provided together",
    )
  }

  if (actionPath && (!actionPath.startsWith("/") || actionPath.startsWith("//"))) {
    throw new AppError(
      400,
      "INVALID_NOTIFICATION_ACTION_PATH",
      "actionPath must be an internal absolute path",
    )
  }

  return {
    recipientId,
    actorId,
    eventKey,
    type,
    title,
    body,
    resourceType,
    resourceId,
    actionPath,
    ...(event.payload === undefined || event.payload === null
      ? {}
      : { payload: event.payload }),
  }
}

function requireTransaction(transaction) {
  if (!transaction?.notification?.upsert) {
    throw new AppError(
      500,
      "NOTIFICATION_TRANSACTION_REQUIRED",
      "A Prisma transaction client is required",
    )
  }

  return transaction
}

async function createNotification(transaction, event) {
  const client = requireTransaction(transaction)
  const data = normalizeEvent(event)

  try {
    const notification = await client.notification.upsert({
      where: { eventKey: data.eventKey },
      update: {},
      create: data,
    })

    if (
      notification.recipientId !== data.recipientId ||
      notification.actorId !== data.actorId ||
      notification.type !== data.type ||
      notification.resourceType !== data.resourceType ||
      notification.resourceId !== data.resourceId
    ) {
      throw new AppError(
        409,
        "NOTIFICATION_EVENT_KEY_CONFLICT",
        "eventKey is already used by a different notification event",
      )
    }

    return toNotificationResponse(notification)
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "NOTIFICATION_EVENT_KEY_CONFLICT",
        "eventKey is already used by another notification",
      )
    }

    throw error
  }
}

async function createNotifications(transaction, events) {
  if (!Array.isArray(events)) {
    throw new AppError(400, "INVALID_NOTIFICATION_EVENTS", "events must be an array")
  }

  const notifications = []
  for (const event of events) {
    notifications.push(await createNotification(transaction, event))
  }

  return notifications
}

async function upsertConversationUnreadNotification(transaction, event) {
  const client = requireTransaction(transaction)
  const data = normalizeEvent(event)
  const expectedEventKey = `MESSAGE_UNREAD:${data.resourceId}:${data.recipientId}`

  if (
    data.type !== "MESSAGE_RECEIVED" ||
    data.resourceType !== "CONVERSATION" ||
    data.eventKey !== expectedEventKey
  ) {
    throw new AppError(
      400,
      "INVALID_MESSAGE_NOTIFICATION_EVENT",
      "Message notification must use the conversation unread aggregation key",
    )
  }

  const notification = await client.notification.upsert({
    where: { eventKey: data.eventKey },
    update: {
      actorId: data.actorId,
      title: data.title,
      body: data.body,
      actionPath: data.actionPath,
      payload: data.payload,
      readAt: null,
      updatedAt: new Date(),
    },
    create: data,
  })

  if (
    notification.recipientId !== data.recipientId ||
    notification.type !== data.type ||
    notification.resourceType !== data.resourceType ||
    notification.resourceId !== data.resourceId
  ) {
    throw new AppError(
      409,
      "NOTIFICATION_EVENT_KEY_CONFLICT",
      "eventKey is already used by a different notification event",
    )
  }

  return toNotificationResponse(notification)
}

async function markConversationUnreadNotificationRead(
  transaction,
  conversationIdInput,
  recipientIdInput,
  readAt,
) {
  const client = requireTransaction(transaction)
  const conversationId = requirePositiveInteger(conversationIdInput, "conversation_id")
  const recipientId = requirePositiveInteger(recipientIdInput, "recipient_id")

  return client.notification.updateMany({
    where: {
      eventKey: `MESSAGE_UNREAD:${conversationId}:${recipientId}`,
      recipientId,
      type: "MESSAGE_RECEIVED",
      readAt: null,
    },
    data: { readAt },
  })
}

async function getNotifications(userIdInput, query = {}) {
  const recipientId = requirePositiveInteger(userIdInput, "user_id")
  const { page, pageSize } = parsePagination(query)
  const where = { recipientId }

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: ACTOR_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    notifications: notifications.map(toNotificationResponse),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  }
}

async function getUnreadCount(userIdInput) {
  const recipientId = requirePositiveInteger(userIdInput, "user_id")
  return prisma.notification.count({
    where: {
      recipientId,
      readAt: null,
    },
  })
}

async function findOwnedNotification(notificationId, recipientId) {
  return prisma.notification.findFirst({
    where: {
      id: notificationId,
      recipientId,
    },
    include: ACTOR_INCLUDE,
  })
}

async function markRead(userIdInput, notificationIdInput) {
  const recipientId = requirePositiveInteger(userIdInput, "user_id")
  const notificationId = requirePositiveInteger(notificationIdInput, "notification_id")
  const notification = await findOwnedNotification(notificationId, recipientId)

  if (!notification) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
  }

  if (notification.readAt) {
    return toNotificationResponse(notification)
  }

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      recipientId,
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  const updated = await findOwnedNotification(notificationId, recipientId)

  if (!updated) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
  }

  return toNotificationResponse(updated)
}

async function markAllRead(userIdInput) {
  const recipientId = requirePositiveInteger(userIdInput, "user_id")
  const readAt = new Date()
  const result = await prisma.notification.updateMany({
    where: {
      recipientId,
      readAt: null,
    },
    data: { readAt },
  })

  return {
    updated_count: result.count,
    read_at: readAt,
  }
}

module.exports = {
  createNotification,
  createNotifications,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markConversationUnreadNotificationRead,
  markRead,
  upsertConversationUnreadNotification,
}
