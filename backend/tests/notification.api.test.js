process.env.DATABASE_URL = "postgresql://notification_test:test@127.0.0.1:1/notification_test"
process.env.JWT_SECRET = "notification-api-test-secret"

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")
const { signToken } = require("../src/utils/jwt")

const originalMethods = {
  userFindUnique: prisma.user.findUnique,
  notificationCount: prisma.notification.count,
  notificationFindMany: prisma.notification.findMany,
  notificationFindFirst: prisma.notification.findFirst,
  notificationUpdateMany: prisma.notification.updateMany,
}

const users = {
  1: {
    id: 1,
    email: "parent@test.com",
    role: "PARENT",
    status: "ACTIVE",
    displayName: "Parent",
  },
  2: {
    id: 2,
    email: "student@test.com",
    role: "STUDENT",
    status: "ACTIVE",
    displayName: "Student",
  },
}

const now = new Date("2026-08-07T09:00:00.000Z")
let notifications
let baseUrl
let server

function resetNotifications() {
  notifications = [
    {
      id: 101,
      recipientId: 1,
      actorId: 2,
      eventKey: "MESSAGE_RECEIVED:101:1",
      type: "MESSAGE_RECEIVED",
      title: "New message",
      body: "You received a new message",
      resourceType: "CONVERSATION",
      resourceId: 10,
      actionPath: "/parent/messages?conversation_id=10",
      payload: null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 102,
      recipientId: 1,
      actorId: 2,
      eventKey: "APPLICATION_RECEIVED:102:1",
      type: "APPLICATION_RECEIVED",
      title: "New application",
      body: "A student applied",
      resourceType: "APPLICATION",
      resourceId: 20,
      actionPath: "/parent/applications",
      payload: null,
      readAt: null,
      createdAt: new Date(now.getTime() - 1000),
      updatedAt: now,
    },
    {
      id: 201,
      recipientId: 2,
      actorId: 1,
      eventKey: "APPLICATION_ACCEPTED:201:2",
      type: "APPLICATION_ACCEPTED",
      title: "Application accepted",
      body: "Your application was accepted",
      resourceType: "APPLICATION",
      resourceId: 21,
      actionPath: "/student/applications",
      payload: null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function matchesWhere(item, where) {
  if (where.id !== undefined && item.id !== where.id) return false
  if (where.recipientId !== undefined && item.recipientId !== where.recipientId) {
    return false
  }
  if (where.readAt === null && item.readAt !== null) return false
  return true
}

function withActor(item) {
  return {
    ...structuredClone(item),
    actor: item.actorId ? users[item.actorId] : null,
  }
}

before(async () => {
  resetNotifications()
  prisma.user.findUnique = async ({ where }) => users[where.id] || null
  prisma.notification.count = async ({ where }) => notifications.filter(
    (item) => matchesWhere(item, where),
  ).length
  prisma.notification.findMany = async ({ where, skip, take }) => notifications
    .filter((item) => matchesWhere(item, where))
    .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
    .slice(skip, skip + take)
    .map(withActor)
  prisma.notification.findFirst = async ({ where }) => {
    const item = notifications.find((candidate) => matchesWhere(candidate, where))
    return item ? withActor(item) : null
  }
  prisma.notification.updateMany = async ({ where, data }) => {
    let count = 0
    for (const item of notifications) {
      if (!matchesWhere(item, where)) continue
      Object.assign(item, data, { updatedAt: new Date() })
      count += 1
    }
    return { count }
  }

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })

  prisma.user.findUnique = originalMethods.userFindUnique
  prisma.notification.count = originalMethods.notificationCount
  prisma.notification.findMany = originalMethods.notificationFindMany
  prisma.notification.findFirst = originalMethods.notificationFindFirst
  prisma.notification.updateMany = originalMethods.notificationUpdateMany
  await prisma.$disconnect()
})

async function request(route, { token, ...options } = {}) {
  const headers = {
    "content-type": "application/json",
    ...options.headers,
  }
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${baseUrl}${route}`, { ...options, headers })
  return {
    status: response.status,
    body: await response.json(),
  }
}

test("Notification API authenticates and isolates every recipient", async () => {
  resetNotifications()
  const parentToken = signToken(users[1])

  const unauthenticated = await request("/api/v1/notifications")
  assert.equal(unauthenticated.status, 401)

  const list = await request("/api/v1/notifications?page=1&page_size=1", {
    token: parentToken,
  })
  assert.equal(list.status, 200)
  assert.equal(list.body.notifications.length, 1)
  assert.equal(list.body.notifications[0].recipient_id, 1)
  assert.equal(list.body.pagination.total, 2)

  const unread = await request("/api/v1/notifications/unread-count", {
    token: parentToken,
  })
  assert.equal(unread.status, 200)
  assert.equal(unread.body.unread_count, 2)

  const foreignRead = await request("/api/v1/notifications/201/read", {
    method: "PATCH",
    token: parentToken,
  })
  assert.equal(foreignRead.status, 404)
  assert.equal(foreignRead.body.error.code, "NOTIFICATION_NOT_FOUND")
  assert.equal(notifications.find((item) => item.id === 201).readAt, null)

  const ownRead = await request("/api/v1/notifications/101/read", {
    method: "PATCH",
    token: parentToken,
  })
  assert.equal(ownRead.status, 200)
  assert.ok(ownRead.body.notification.read_at)

  const repeatedRead = await request("/api/v1/notifications/101/read", {
    method: "PATCH",
    token: parentToken,
  })
  assert.equal(repeatedRead.status, 200)
  assert.equal(
    repeatedRead.body.notification.read_at,
    ownRead.body.notification.read_at,
  )

  const allRead = await request("/api/v1/notifications/read-all", {
    method: "PATCH",
    token: parentToken,
  })
  assert.equal(allRead.status, 200)
  assert.equal(allRead.body.updated_count, 1)
  assert.equal(notifications.find((item) => item.id === 201).readAt, null)

  const finalUnread = await request("/api/v1/notifications/unread-count", {
    token: parentToken,
  })
  assert.equal(finalUnread.body.unread_count, 0)
})
