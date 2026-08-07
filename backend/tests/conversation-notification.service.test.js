const assert = require("node:assert/strict")
const { test } = require("node:test")

const PARENT_ID = 10
const STUDENT_ID = 20

function createFixture() {
  const conversations = [
    {
      id: 88,
      applicationId: 40,
      demandId: 30,
      parentId: PARENT_ID,
      studentId: STUDENT_ID,
      status: "ACTIVE",
      lastMessageAt: null,
    },
    {
      id: 89,
      applicationId: 41,
      demandId: 31,
      parentId: PARENT_ID,
      studentId: STUDENT_ID,
      status: "ACTIVE",
      lastMessageAt: null,
    },
  ]
  const messages = []
  const notifications = []
  let failNextNotification = false

  function matchesReadAt(actual, expected) {
    return expected === undefined || actual === expected
  }

  const transaction = {
    conversation: {
      findUnique: async ({ where }) => (
        conversations.find(({ id }) => id === where.id) || null
      ),
      update: async ({ where, data }) => {
        const conversation = conversations.find(({ id }) => id === where.id)
        Object.assign(conversation, data)
        return conversation
      },
    },
    message: {
      create: async ({ data }) => {
        const message = {
          id: messages.length + 1,
          readAt: null,
          ...data,
        }
        messages.push(message)
        return message
      },
      findMany: async ({ where }) => messages.filter(
        ({ conversationId }) => conversationId === where.conversationId,
      ),
      updateMany: async ({ where, data }) => {
        const matchingMessages = messages.filter((message) => (
          message.conversationId === where.conversationId &&
          message.receiverId === where.receiverId &&
          matchesReadAt(message.readAt, where.readAt)
        ))
        matchingMessages.forEach((message) => Object.assign(message, data))
        return { count: matchingMessages.length }
      },
    },
    notification: {
      upsert: async ({ where, update, create }) => {
        if (failNextNotification) {
          failNextNotification = false
          throw new Error("notification write failed")
        }

        const existing = notifications.find(
          ({ eventKey }) => eventKey === where.eventKey,
        )
        if (existing) {
          Object.assign(existing, update)
          return existing
        }

        const now = new Date()
        const notification = {
          id: notifications.length + 100,
          actorId: null,
          resourceType: null,
          resourceId: null,
          actionPath: null,
          payload: null,
          readAt: null,
          createdAt: now,
          updatedAt: now,
          ...create,
        }
        notifications.push(notification)
        return notification
      },
      findFirst: async ({ where }) => notifications.find((notification) => (
        notification.id === where.id &&
        notification.recipientId === where.recipientId
      )) || null,
      updateMany: async ({ where, data }) => {
        const matchingNotifications = notifications.filter((notification) => (
          (where.id === undefined || notification.id === where.id) &&
          (where.eventKey === undefined || notification.eventKey === where.eventKey) &&
          (where.recipientId === undefined || notification.recipientId === where.recipientId) &&
          (where.type === undefined || notification.type === where.type) &&
          matchesReadAt(notification.readAt, where.readAt)
        ))
        matchingNotifications.forEach((notification) => Object.assign(notification, data))
        return { count: matchingNotifications.length }
      },
    },
  }

  async function runTransaction(operation) {
    const conversationSnapshots = conversations.map((conversation) => ({ ...conversation }))
    const messageSnapshots = messages.map((message) => ({ ...message }))
    const notificationSnapshots = notifications.map((notification) => ({
      ...notification,
      payload: notification.payload ? { ...notification.payload } : notification.payload,
    }))

    try {
      return await operation(transaction)
    } catch (error) {
      conversations.splice(
        0,
        conversations.length,
        ...conversationSnapshots.map((conversation) => ({ ...conversation })),
      )
      messages.splice(
        0,
        messages.length,
        ...messageSnapshots.map((message) => ({ ...message })),
      )
      notifications.splice(
        0,
        notifications.length,
        ...notificationSnapshots.map((notification) => ({ ...notification })),
      )
      throw error
    }
  }

  return {
    prisma: {
      ...transaction,
      $transaction: runTransaction,
    },
    state: {
      conversations,
      messages,
      notifications,
      addUnreadMessage({ conversationId = 88, senderId = STUDENT_ID } = {}) {
        const receiverId = senderId === PARENT_ID ? STUDENT_ID : PARENT_ID
        const message = {
          id: messages.length + 1,
          conversationId,
          senderId,
          receiverId,
          content: "Historical message",
          messageType: "TEXT",
          sentAt: new Date(),
          readAt: null,
        }
        messages.push(message)
        return message
      },
      failNextNotification() {
        failNextNotification = true
      },
    },
  }
}

function assertMessageNotification(notification, {
  conversationId,
  recipientId,
  actorId,
  latestMessageId,
}) {
  assert.equal(notification.type, "MESSAGE_RECEIVED")
  assert.equal(notification.eventKey, `MESSAGE_UNREAD:${conversationId}:${recipientId}`)
  assert.equal(notification.recipientId, recipientId)
  assert.equal(notification.actorId, actorId)
  assert.equal(notification.resourceType, "CONVERSATION")
  assert.equal(notification.resourceId, conversationId)
  assert.equal(
    notification.actionPath,
    recipientId === PARENT_ID ? "/parent/messages" : "/student/messages",
  )
  assert.deepEqual(notification.payload, {
    conversation_id: conversationId,
    sender_id: actorId,
    latest_message_id: latestMessageId,
  })
  assert.equal(Object.hasOwn(notification.payload, "content"), false)
}

async function assertRejectCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, code)
    return true
  })
}

test("Conversation messages maintain one unread notification per recipient", async (t) => {
  const prismaPath = require.resolve("../src/prisma/client")
  const notificationServicePath = require.resolve("../src/services/notificationService")
  const conversationServicePath = require.resolve("../src/services/conversationService")
  const originalPrismaModule = require.cache[prismaPath]
  const originalNotificationServiceModule = require.cache[notificationServicePath]
  const originalConversationServiceModule = require.cache[conversationServicePath]
  let activeFixture

  const prismaProxy = new Proxy({}, {
    get(_target, property) {
      return activeFixture.prisma[property]
    },
  })

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaProxy,
  }
  delete require.cache[notificationServicePath]
  delete require.cache[conversationServicePath]

  t.after(() => {
    if (originalPrismaModule) {
      require.cache[prismaPath] = originalPrismaModule
    } else {
      delete require.cache[prismaPath]
    }

    if (originalNotificationServiceModule) {
      require.cache[notificationServicePath] = originalNotificationServiceModule
    } else {
      delete require.cache[notificationServicePath]
    }

    if (originalConversationServiceModule) {
      require.cache[conversationServicePath] = originalConversationServiceModule
    } else {
      delete require.cache[conversationServicePath]
    }
  })

  const notificationService = require(notificationServicePath)
  const conversationService = require(conversationServicePath)

  await t.test("first and ten subsequent messages share one refreshed notification", async () => {
    activeFixture = createFixture()

    await conversationService.sendMessage(STUDENT_ID, 88, { content: "Message 1" })
    assert.equal(activeFixture.state.messages.length, 1)
    assert.equal(activeFixture.state.notifications.length, 1)
    assertMessageNotification(activeFixture.state.notifications[0], {
      conversationId: 88,
      recipientId: PARENT_ID,
      actorId: STUDENT_ID,
      latestMessageId: 1,
    })

    for (let index = 2; index <= 11; index += 1) {
      await conversationService.sendMessage(STUDENT_ID, 88, {
        content: `Message ${index}`,
      })
    }

    assert.equal(activeFixture.state.messages.length, 11)
    assert.equal(activeFixture.state.notifications.length, 1)
    assert.equal(activeFixture.state.notifications[0].readAt, null)
    assertMessageNotification(activeFixture.state.notifications[0], {
      conversationId: 88,
      recipientId: PARENT_ID,
      actorId: STUDENT_ID,
      latestMessageId: 11,
    })
  })

  await t.test("markRead synchronizes messages and notification, then a message reopens it", async () => {
    activeFixture = createFixture()
    await conversationService.sendMessage(STUDENT_ID, 88, { content: "First" })
    await conversationService.sendMessage(STUDENT_ID, 88, { content: "Second" })

    const result = await conversationService.markRead(PARENT_ID, 88)

    assert.equal(result.updated_count, 2)
    assert.ok(activeFixture.state.messages.every(({ readAt }) => readAt instanceof Date))
    assert.ok(activeFixture.state.notifications[0].readAt instanceof Date)

    await conversationService.sendMessage(STUDENT_ID, 88, { content: "Third" })

    assert.equal(activeFixture.state.messages.length, 3)
    assert.equal(activeFixture.state.notifications.length, 1)
    assert.equal(activeFixture.state.notifications[0].readAt, null)
    assertMessageNotification(activeFixture.state.notifications[0], {
      conversationId: 88,
      recipientId: PARENT_ID,
      actorId: STUDENT_ID,
      latestMessageId: 3,
    })
  })

  await t.test("different conversations and opposite recipients use independent keys", async () => {
    activeFixture = createFixture()

    await conversationService.sendMessage(STUDENT_ID, 88, { content: "Conversation 88" })
    await conversationService.sendMessage(STUDENT_ID, 89, { content: "Conversation 89" })
    await conversationService.sendMessage(PARENT_ID, 88, { content: "Reply" })

    assert.equal(activeFixture.state.notifications.length, 3)
    assert.deepEqual(
      new Set(activeFixture.state.notifications.map(({ eventKey }) => eventKey)),
      new Set([
        "MESSAGE_UNREAD:88:10",
        "MESSAGE_UNREAD:89:10",
        "MESSAGE_UNREAD:88:20",
      ]),
    )
  })

  await t.test("notification failure rolls back the message and conversation timestamp", async () => {
    activeFixture = createFixture()
    activeFixture.state.failNextNotification()

    await assert.rejects(
      () => conversationService.sendMessage(STUDENT_ID, 88, { content: "Rollback" }),
      /notification write failed/,
    )

    assert.equal(activeFixture.state.messages.length, 0)
    assert.equal(activeFixture.state.notifications.length, 0)
    assert.equal(activeFixture.state.conversations[0].lastMessageAt, null)
  })

  await t.test("markRead succeeds when the aggregate notification does not exist", async () => {
    activeFixture = createFixture()
    const message = activeFixture.state.addUnreadMessage()

    const result = await conversationService.markRead(PARENT_ID, 88)

    assert.equal(result.updated_count, 1)
    assert.ok(message.readAt instanceof Date)
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  await t.test("notification-center markRead does not mark conversation messages", async () => {
    activeFixture = createFixture()
    await conversationService.sendMessage(STUDENT_ID, 88, { content: "Unread" })
    const notification = activeFixture.state.notifications[0]

    await notificationService.markRead(PARENT_ID, notification.id)

    assert.ok(notification.readAt instanceof Date)
    assert.equal(activeFixture.state.messages[0].readAt, null)
  })

  await t.test("non-participants still cannot read, send, or mark messages read", async () => {
    activeFixture = createFixture()

    await assertRejectCode(
      () => conversationService.getMessages(999, 88),
      "FORBIDDEN",
    )
    await assertRejectCode(
      () => conversationService.sendMessage(999, 88, { content: "Forbidden" }),
      "FORBIDDEN",
    )
    await assertRejectCode(
      () => conversationService.markRead(999, 88),
      "FORBIDDEN",
    )
    assert.equal(activeFixture.state.messages.length, 0)
    assert.equal(activeFixture.state.notifications.length, 0)
  })
})
