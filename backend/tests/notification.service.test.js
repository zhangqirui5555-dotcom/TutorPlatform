const assert = require("node:assert/strict")
const { test } = require("node:test")

function createFakePrisma() {
  const notifications = []
  let nextId = 1

  function matchesWhere(notification, where) {
    if (where.id !== undefined && notification.id !== where.id) return false
    if (
      where.recipientId !== undefined &&
      notification.recipientId !== where.recipientId
    ) return false
    if (where.readAt === null && notification.readAt !== null) return false
    return true
  }

  const notification = {
    upsert: async ({ where, create }) => {
      const existing = notifications.find(
        (item) => item.eventKey === where.eventKey,
      )
      if (existing) return structuredClone(existing)

      const now = new Date("2026-08-07T08:00:00.000Z")
      const created = {
        id: nextId++,
        actorId: null,
        resourceType: null,
        resourceId: null,
        actionPath: null,
        payload: null,
        readAt: null,
        createdAt: now,
        updatedAt: now,
        ...structuredClone(create),
      }
      notifications.push(created)
      return structuredClone(created)
    },
    count: async ({ where }) => notifications.filter(
      (item) => matchesWhere(item, where),
    ).length,
    findMany: async ({ where, skip, take }) => notifications
      .filter((item) => matchesWhere(item, where))
      .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
      .slice(skip, skip + take)
      .map((item) => ({ ...structuredClone(item), actor: null })),
    findFirst: async ({ where }) => {
      const item = notifications.find((candidate) => matchesWhere(candidate, where))
      return item ? { ...structuredClone(item), actor: null } : null
    },
    updateMany: async ({ where, data }) => {
      let count = 0
      for (const item of notifications) {
        if (!matchesWhere(item, where)) continue
        Object.assign(item, data, { updatedAt: new Date() })
        count += 1
      }
      return { count }
    },
  }

  return {
    prisma: { notification },
    notifications,
  }
}

function event(overrides = {}) {
  return {
    recipientId: 10,
    actorId: 20,
    eventKey: "APPLICATION_ACCEPTED:100:10",
    type: "application_accepted",
    title: "Application accepted",
    body: "Your application was accepted",
    resourceType: "APPLICATION",
    resourceId: 100,
    actionPath: "/student/applications",
    payload: { order_id: 300 },
    ...overrides,
  }
}

test("Notification service enforces idempotency, ownership, and pagination", async (t) => {
  const { prisma, notifications } = createFakePrisma()
  const prismaPath = require.resolve("../src/prisma/client")
  const servicePath = require.resolve("../src/services/notificationService")
  const originalPrismaModule = require.cache[prismaPath]

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  }
  delete require.cache[servicePath]

  t.after(() => {
    delete require.cache[servicePath]
    if (originalPrismaModule) {
      require.cache[prismaPath] = originalPrismaModule
    } else {
      delete require.cache[prismaPath]
    }
  })

  const service = require(servicePath)
  const first = await service.createNotification(prisma, event())
  const duplicate = await service.createNotification(prisma, event({
    title: "This text must not overwrite the original",
  }))

  assert.equal(first.id, duplicate.id)
  assert.equal(duplicate.title, "Application accepted")
  assert.equal(notifications.length, 1)

  const batch = await service.createNotifications(prisma, [
    event({
      eventKey: "ORDER_CONFIRMED:301:10",
      type: "ORDER_CONFIRMED",
      resourceType: "ORDER",
      resourceId: 301,
      actionPath: "/student/orders/301",
    }),
    event({
      recipientId: 11,
      eventKey: "MESSAGE_RECEIVED:501:11",
      type: "MESSAGE_RECEIVED",
      resourceType: "CONVERSATION",
      resourceId: 401,
      actionPath: "/student/messages?conversation_id=401",
    }),
  ])
  assert.equal(batch.length, 2)

  const page = await service.getNotifications(10, { page: "1", page_size: "1" })
  assert.equal(page.notifications.length, 1)
  assert.equal(page.pagination.total, 2)
  assert.equal(page.pagination.total_pages, 2)
  assert.ok(page.notifications.every((item) => item.recipient_id === 10))

  await assert.rejects(
    service.getNotifications(10, { page_size: "51" }),
    (error) => error.code === "INVALID_PAGE_SIZE",
  )

  const foreignNotificationId = notifications.find(
    (item) => item.recipientId === 11,
  ).id
  await assert.rejects(
    service.markRead(10, foreignNotificationId),
    (error) => error.statusCode === 404 && error.code === "NOTIFICATION_NOT_FOUND",
  )

  const read = await service.markRead(10, first.id)
  const repeatedRead = await service.markRead(10, first.id)
  assert.ok(read.read_at)
  assert.equal(repeatedRead.read_at.getTime(), read.read_at.getTime())

  const allRead = await service.markAllRead(10)
  assert.equal(allRead.updated_count, 1)
  assert.equal(await service.getUnreadCount(10), 0)
  assert.equal(await service.getUnreadCount(11), 1)

  await assert.rejects(
    service.createNotification(prisma, event({
      recipientId: 99,
    })),
    (error) => error.statusCode === 409 &&
      error.code === "NOTIFICATION_EVENT_KEY_CONFLICT",
  )
})
