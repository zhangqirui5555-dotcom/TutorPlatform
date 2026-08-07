const assert = require("node:assert/strict")
const { test } = require("node:test")

function createFakePrisma() {
  const now = new Date("2026-08-07T00:00:00.000Z")
  const parent = {
    id: 10,
    email: "parent@test.com",
    displayName: "Parent",
    role: "PARENT",
  }
  const student = {
    id: 20,
    email: "student@test.com",
    displayName: "Student",
    role: "STUDENT",
  }
  const demand = {
    id: 30,
    parentId: parent.id,
    title: "Math tutor",
    childGrade: "Grade 8",
    subject: "MATH",
    region: "Shanghai",
    status: "RECRUITING",
    matchedAt: null,
  }
  const application = {
    id: 40,
    studentId: student.id,
    demandId: demand.id,
    coverMessage: "I can help",
    status: "PENDING",
    viewedAt: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const conversations = []
  const notifications = []
  const orders = []
  const trialLessons = []

  function applicationRecord() {
    return {
      ...application,
      demand: { ...demand },
      order: orders.find((order) => order.applicationId === application.id) || null,
    }
  }

  const transaction = {
    application: {
      findUnique: async ({ where }) => (
        where.id === application.id ? applicationRecord() : null
      ),
      findMany: async () => [],
      updateMany: async ({ where, data }) => {
        if (typeof where.id !== "number") {
          return { count: 0 }
        }

        if (!where.status.in.includes(application.status)) {
          return { count: 0 }
        }

        Object.assign(application, data, { updatedAt: now })
        return { count: 1 }
      },
    },
    conversation: {
      upsert: async ({ where, create }) => {
        const existing = conversations.find(
          (conversation) => conversation.applicationId === where.applicationId,
        )

        if (existing) {
          return existing
        }

        const conversation = {
          id: conversations.length + 50,
          ...create,
          createdAt: now,
          updatedAt: now,
        }
        conversations.push(conversation)
        return conversation
      },
    },
    demand: {
      updateMany: async ({ where, data }) => {
        if (where.id !== demand.id || where.status !== demand.status) {
          return { count: 0 }
        }

        Object.assign(demand, data)
        return { count: 1 }
      },
    },
    order: {
      upsert: async ({ where, create }) => {
        const existing = orders.find(
          (order) => order.applicationId === where.applicationId,
        )

        if (existing) {
          return existing
        }

        const order = {
          id: orders.length + 60,
          totalAmount: null,
          platformFee: null,
          currency: "CNY",
          confirmedAt: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
          ...create,
        }
        orders.push(order)
        return order
      },
    },
    trialLesson: {
      create: async ({ data }) => {
        const trialLesson = {
          id: trialLessons.length + 70,
          cancellationReason: null,
          confirmedAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        }
        trialLessons.push(trialLesson)
        return trialLesson
      },
    },
    notification: {
      upsert: async ({ where, create }) => {
        const existing = notifications.find(
          (notification) => notification.eventKey === where.eventKey,
        )

        if (existing) {
          return existing
        }

        const notification = {
          id: notifications.length + 80,
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
    },
  }

  return {
    prisma: {
      ...transaction,
      $transaction: async (operation) => operation(transaction),
    },
    state: {
      application,
      conversations,
      demand,
      notifications,
      orders,
      trialLessons,
    },
  }
}

test("accepting an application creates one order and links new trial lessons", async (t) => {
  const { prisma, state } = createFakePrisma()
  const prismaPath = require.resolve("../src/prisma/client")
  const applicationServicePath = require.resolve("../src/services/applicationService")
  const trialLessonServicePath = require.resolve("../src/services/trialLessonService")
  const originalPrismaModule = require.cache[prismaPath]

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  }
  delete require.cache[applicationServicePath]
  delete require.cache[trialLessonServicePath]

  t.after(() => {
    delete require.cache[applicationServicePath]
    delete require.cache[trialLessonServicePath]

    if (originalPrismaModule) {
      require.cache[prismaPath] = originalPrismaModule
    } else {
      delete require.cache[prismaPath]
    }
  })

  const applicationService = require(applicationServicePath)
  const trialLessonService = require(trialLessonServicePath)

  const firstResult = await applicationService.acceptApplication(10, 40)

  assert.equal(state.application.status, "ACCEPTED")
  assert.equal(state.demand.status, "MATCHED")
  assert.equal(state.conversations.length, 1)
  assert.equal(state.orders.length, 1)
  assert.equal(state.notifications.length, 1)
  assert.equal(firstResult.conversation.status, "ACTIVE")
  assert.equal(firstResult.order.status, "PENDING")

  const repeatedResult = await applicationService.acceptApplication(10, 40)

  assert.equal(state.conversations.length, 1)
  assert.equal(state.orders.length, 1)
  assert.equal(state.notifications.length, 1)
  assert.equal(repeatedResult.conversation.id, firstResult.conversation.id)
  assert.equal(repeatedResult.order.id, firstResult.order.id)

  const trialLesson = await trialLessonService.createTrialLesson(20, 40, {
    scheduled_start_at: "2026-08-08T01:00:00.000Z",
    scheduled_end_at: "2026-08-08T02:00:00.000Z",
    method: "ONLINE",
    location_or_link: "https://example.test/trial",
  })

  assert.equal(state.trialLessons.length, 1)
  assert.equal(state.trialLessons[0].orderId, firstResult.order.id)
  assert.equal(trialLesson.order_id, firstResult.order.id)
})
