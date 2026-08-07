const assert = require("node:assert/strict")
const { test } = require("node:test")

function createFakePrisma() {
  const now = new Date("2026-08-07T10:00:00.000Z")
  const demands = [
    {
      id: 30,
      parentId: 10,
      title: "Math tutor",
      childGrade: "Grade 8",
      subject: "MATH",
      region: "Shanghai",
      status: "RECRUITING",
      visibilityStatus: "VISIBLE",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      parent: { role: "PARENT", status: "ACTIVE" },
      matchedAt: null,
    },
    {
      id: 31,
      parentId: 11,
      title: "English tutor",
      childGrade: "Grade 7",
      subject: "ENGLISH",
      region: "Shanghai",
      status: "RECRUITING",
      visibilityStatus: "VISIBLE",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      parent: { role: "PARENT", status: "ACTIVE" },
      matchedAt: null,
    },
  ]
  const applications = [
    {
      id: 40,
      studentId: 20,
      demandId: 30,
      coverMessage: "Target application",
      status: "PENDING",
      viewedAt: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 41,
      studentId: 21,
      demandId: 30,
      coverMessage: "Competing application one",
      status: "PENDING",
      viewedAt: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 42,
      studentId: 22,
      demandId: 30,
      coverMessage: "Competing application two",
      status: "VIEWED",
      viewedAt: now,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]
  const conversations = []
  const notifications = []
  const orders = []
  let nextApplicationId = 50
  let failNextNotification = false

  function applicationRecord(application) {
    const demand = demands.find((item) => item.id === application.demandId)
    return {
      ...structuredClone(application),
      demand: structuredClone(demand),
    }
  }

  function statusMatches(status, condition) {
    if (!condition) return true
    if (condition.in) return condition.in.includes(status)
    return status === condition
  }

  const transaction = {
    application: {
      create: async ({ data }) => {
        const application = {
          id: nextApplicationId++,
          viewedAt: null,
          decidedAt: null,
          createdAt: now,
          updatedAt: now,
          ...structuredClone(data),
        }
        applications.push(application)
        return applicationRecord(application)
      },
      findUnique: async ({ where }) => {
        const application = applications.find((item) => item.id === where.id)
        return application ? applicationRecord(application) : null
      },
      findMany: async ({ where }) => applications
        .filter((application) => (
          application.demandId === where.demandId &&
          application.id !== where.id.not &&
          statusMatches(application.status, where.status)
        ))
        .map((application) => ({
          id: application.id,
          studentId: application.studentId,
          demandId: application.demandId,
        })),
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const application of applications) {
          if (where.id !== undefined) {
            if (typeof where.id === "number" && application.id !== where.id) continue
            if (where.id.not !== undefined && application.id === where.id.not) continue
          }
          if (where.demandId !== undefined && application.demandId !== where.demandId) {
            continue
          }
          if (!statusMatches(application.status, where.status)) continue

          Object.assign(application, data, { updatedAt: now })
          count += 1
        }
        return { count }
      },
    },
    conversation: {
      upsert: async ({ where, create }) => {
        const existing = conversations.find(
          (conversation) => conversation.applicationId === where.applicationId,
        )
        if (existing) return structuredClone(existing)

        const conversation = {
          id: conversations.length + 60,
          createdAt: now,
          updatedAt: now,
          ...structuredClone(create),
        }
        conversations.push(conversation)
        return structuredClone(conversation)
      },
    },
    demand: {
      findFirst: async ({ where }) => {
        const demand = demands.find((item) => item.id === where.id)
        if (
          !demand ||
          demand.status !== where.status ||
          demand.visibilityStatus !== where.visibilityStatus ||
          demand.parent.role !== where.parent.is.role ||
          demand.parent.status !== where.parent.is.status ||
          (demand.expiresAt !== null && demand.expiresAt <= where.OR[1].expiresAt.gt)
        ) {
          return null
        }

        return structuredClone(demand)
      },
      updateMany: async ({ where, data }) => {
        const demand = demands.find((item) => item.id === where.id)
        if (!demand || demand.status !== where.status) return { count: 0 }
        Object.assign(demand, data)
        return { count: 1 }
      },
    },
    order: {
      upsert: async ({ where, create }) => {
        const existing = orders.find(
          (order) => order.applicationId === where.applicationId,
        )
        if (existing) return structuredClone(existing)

        const order = {
          id: orders.length + 70,
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
          ...structuredClone(create),
        }
        orders.push(order)
        return structuredClone(order)
      },
    },
    notification: {
      upsert: async ({ where, create }) => {
        if (failNextNotification) {
          failNextNotification = false
          throw new Error("simulated notification write failure")
        }

        const existing = notifications.find(
          (notification) => notification.eventKey === where.eventKey,
        )
        if (existing) return structuredClone(existing)

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
          ...structuredClone(create),
        }
        notifications.push(notification)
        return structuredClone(notification)
      },
    },
  }

  const prisma = {
    ...transaction,
    certification: {
      findFirst: async () => ({ status: "APPROVED" }),
    },
    demand: {
      ...transaction.demand,
      findUnique: async ({ where }) => {
        const demand = demands.find((item) => item.id === where.id)
        return demand ? structuredClone(demand) : null
      },
    },
    $transaction: async (operation) => {
      const snapshot = {
        applications: structuredClone(applications),
        conversations: structuredClone(conversations),
        demands: structuredClone(demands),
        notifications: structuredClone(notifications),
        orders: structuredClone(orders),
      }

      try {
        return await operation(transaction)
      } catch (error) {
        applications.splice(0, applications.length, ...snapshot.applications)
        conversations.splice(0, conversations.length, ...snapshot.conversations)
        demands.splice(0, demands.length, ...snapshot.demands)
        notifications.splice(0, notifications.length, ...snapshot.notifications)
        orders.splice(0, orders.length, ...snapshot.orders)
        throw error
      }
    },
  }

  return {
    prisma,
    state: {
      applications,
      conversations,
      demands,
      notifications,
      orders,
      failNextNotification() {
        failNextNotification = true
      },
    },
  }
}

test("Application events create recipient-scoped idempotent notifications", async (t) => {
  const { prisma, state } = createFakePrisma()
  const prismaPath = require.resolve("../src/prisma/client")
  const notificationServicePath = require.resolve("../src/services/notificationService")
  const applicationServicePath = require.resolve("../src/services/applicationService")
  const originalPrismaModule = require.cache[prismaPath]

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  }
  delete require.cache[notificationServicePath]
  delete require.cache[applicationServicePath]

  t.after(() => {
    delete require.cache[applicationServicePath]
    delete require.cache[notificationServicePath]
    if (originalPrismaModule) {
      require.cache[prismaPath] = originalPrismaModule
    } else {
      delete require.cache[prismaPath]
    }
  })

  const applicationService = require(applicationServicePath)

  const submitted = await applicationService.submitApplication(23, 31, {
    cover_message: "New application for notification testing",
  })
  const receivedNotification = state.notifications.find(
    (notification) => notification.eventKey ===
      `APPLICATION_RECEIVED:${submitted.id}`,
  )
  assert.equal(receivedNotification.recipientId, 11)
  assert.equal(receivedNotification.actorId, 23)
  assert.equal(receivedNotification.type, "APPLICATION_RECEIVED")

  const accepted = await applicationService.acceptApplication(10, 40)
  assert.equal(accepted.application.status, "ACCEPTED")
  assert.equal(state.demands.find((demand) => demand.id === 30).status, "MATCHED")
  assert.equal(state.conversations.length, 1)
  assert.equal(state.orders.length, 1)

  const acceptedNotification = state.notifications.find(
    (notification) => notification.eventKey === "APPLICATION_ACCEPTED:40",
  )
  assert.equal(acceptedNotification.recipientId, 20)
  assert.equal(acceptedNotification.type, "APPLICATION_ACCEPTED")

  for (const [applicationId, studentId] of [[41, 21], [42, 22]]) {
    const application = state.applications.find((item) => item.id === applicationId)
    const rejectedNotification = state.notifications.find(
      (notification) => notification.eventKey ===
        `APPLICATION_REJECTED:${applicationId}`,
    )
    assert.equal(application.status, "REJECTED")
    assert.equal(rejectedNotification.recipientId, studentId)
    assert.equal(rejectedNotification.type, "APPLICATION_REJECTED")
  }

  const notificationCount = state.notifications.length
  const repeated = await applicationService.acceptApplication(10, 40)
  assert.equal(repeated.order.id, accepted.order.id)
  assert.equal(state.notifications.length, notificationCount)
  assert.equal(
    state.notifications.filter(
      (notification) => notification.eventKey === "APPLICATION_ACCEPTED:40",
    ).length,
    1,
  )

  const manuallyRejected = await applicationService.rejectApplication(11, submitted.id)
  assert.equal(manuallyRejected.status, "REJECTED")
  const manualRejectionNotification = state.notifications.find(
    (notification) => notification.eventKey ===
      `APPLICATION_REJECTED:${submitted.id}`,
  )
  assert.equal(manualRejectionNotification.recipientId, 23)
  assert.equal(manualRejectionNotification.actorId, 11)
  assert.equal(manualRejectionNotification.type, "APPLICATION_REJECTED")
  assert.equal(manualRejectionNotification.actionPath, "/student/applications")
  assert.notEqual(manualRejectionNotification.recipientId, 11)

  const manualNotificationCount = state.notifications.length
  await assert.rejects(
    applicationService.rejectApplication(11, submitted.id),
    (error) => error.statusCode === 409 &&
      error.code === "INVALID_APPLICATION_STATUS",
  )
  assert.equal(state.notifications.length, manualNotificationCount)

  const protectedApplication = await applicationService.submitApplication(24, 31, {
    cover_message: "Application used for ownership and rollback testing",
  })
  await assert.rejects(
    applicationService.rejectApplication(24, protectedApplication.id),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN",
  )
  assert.equal(
    state.applications.find((item) => item.id === protectedApplication.id).status,
    "PENDING",
  )

  state.failNextNotification()
  await assert.rejects(
    applicationService.rejectApplication(11, protectedApplication.id),
    /simulated notification write failure/,
  )
  assert.equal(
    state.applications.find((item) => item.id === protectedApplication.id).status,
    "PENDING",
  )
  assert.equal(
    state.notifications.some(
      (notification) => notification.eventKey ===
        `APPLICATION_REJECTED:${protectedApplication.id}`,
    ),
    false,
  )
})
