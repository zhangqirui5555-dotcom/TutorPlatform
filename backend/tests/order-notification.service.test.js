const assert = require("node:assert/strict")
const { test } = require("node:test")

const PARENT = { id: 10, role: "PARENT" }
const STUDENT = { id: 20, role: "STUDENT" }
const ADMIN = { id: 99, role: "ADMIN" }

function createFixture(initialStatus = "PENDING") {
  const now = new Date("2026-08-07T00:00:00.000Z")
  const order = {
    id: 100,
    parentId: PARENT.id,
    studentId: STUDENT.id,
    demandId: 30,
    applicationId: 40,
    totalAmount: initialStatus === "PENDING" ? null : 15000,
    platformFee: initialStatus === "PENDING" ? null : 1000,
    currency: "CNY",
    status: initialStatus,
    confirmedAt: initialStatus === "PENDING" ? null : now,
    startedAt: ["IN_PROGRESS", "COMPLETED"].includes(initialStatus) ? now : null,
    completedAt: initialStatus === "COMPLETED" ? now : null,
    cancelledAt: initialStatus === "CANCELLED" ? now : null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
  }
  const demand = {
    id: order.demandId,
    title: "Math tutor",
    subject: "MATH",
    region: "Shanghai",
    status: initialStatus === "COMPLETED" ? "COMPLETED" : "MATCHED",
    completedAt: initialStatus === "COMPLETED" ? now : null,
  }
  const notifications = []
  let failNextNotification = false
  let failNextOrderUpdate = false

  function orderRecord() {
    return {
      ...order,
      parent: {
        id: PARENT.id,
        email: "parent@test.com",
        displayName: "Parent",
        role: PARENT.role,
      },
      student: {
        id: STUDENT.id,
        email: "student@test.com",
        displayName: "Student",
        role: STUDENT.role,
      },
      demand: { ...demand },
      application: {
        id: order.applicationId,
        status: "ACCEPTED",
        conversation: { id: 50 },
      },
      trialLessons: [],
    }
  }

  const transaction = {
    order: {
      findUnique: async ({ where }) => (
        where.id === order.id ? orderRecord() : null
      ),
      updateMany: async ({ where, data }) => {
        if (failNextOrderUpdate) {
          failNextOrderUpdate = false
          return { count: 0 }
        }

        const expectedStatuses = typeof where.status === "string"
          ? [where.status]
          : where.status.in

        if (where.id !== order.id || !expectedStatuses.includes(order.status)) {
          return { count: 0 }
        }

        Object.assign(order, data, { updatedAt: now })
        return { count: 1 }
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
    trialLesson: {
      count: async () => 1,
    },
    notification: {
      upsert: async ({ where, create }) => {
        if (failNextNotification) {
          failNextNotification = false
          throw new Error("notification write failed")
        }

        const existing = notifications.find(
          (notification) => notification.eventKey === where.eventKey,
        )
        if (existing) {
          return existing
        }

        const notification = {
          id: notifications.length + 200,
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

  async function runTransaction(operation) {
    const orderSnapshot = { ...order }
    const demandSnapshot = { ...demand }
    const notificationCount = notifications.length

    try {
      return await operation(transaction)
    } catch (error) {
      Object.assign(order, orderSnapshot)
      Object.assign(demand, demandSnapshot)
      notifications.splice(notificationCount)
      throw error
    }
  }

  return {
    prisma: {
      ...transaction,
      $transaction: runTransaction,
    },
    state: {
      demand,
      notifications,
      order,
      failNextNotification() {
        failNextNotification = true
      },
      failNextOrderUpdate() {
        failNextOrderUpdate = true
      },
    },
  }
}

function assertNotification(notification, expected) {
  assert.equal(notification.type, expected.type)
  assert.equal(notification.recipientId, expected.recipientId)
  assert.equal(notification.actorId, expected.actorId)
  assert.equal(notification.resourceType, "ORDER")
  assert.equal(notification.resourceId, 100)
  assert.equal(notification.actionPath, expected.actionPath)
  assert.equal(
    notification.eventKey,
    `${expected.type}:100:${expected.recipientId}`,
  )
}

async function assertRejectCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, code)
    return true
  })
}

test("Order state changes create transactional participant notifications", async (t) => {
  const prismaPath = require.resolve("../src/prisma/client")
  const notificationServicePath = require.resolve("../src/services/notificationService")
  const orderServicePath = require.resolve("../src/services/orderService")
  const originalPrismaModule = require.cache[prismaPath]
  const originalNotificationServiceModule = require.cache[notificationServicePath]
  const originalOrderServiceModule = require.cache[orderServicePath]
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
  delete require.cache[orderServicePath]

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

    if (originalOrderServiceModule) {
      require.cache[orderServicePath] = originalOrderServiceModule
    } else {
      delete require.cache[orderServicePath]
    }
  })

  const orderService = require(orderServicePath)

  await t.test("parent terms confirmation notifies only the student", async () => {
    activeFixture = createFixture()

    await orderService.updateTerms(PARENT, 100, {
      total_amount: 15000,
      currency: "cny",
    })

    assert.equal(activeFixture.state.order.status, "CONFIRMED")
    assert.equal(activeFixture.state.notifications.length, 1)
    assertNotification(activeFixture.state.notifications[0], {
      type: "ORDER_CONFIRMED",
      recipientId: STUDENT.id,
      actorId: PARENT.id,
      actionPath: "/student/orders",
    })
    assert.deepEqual(activeFixture.state.notifications[0].payload, {
      order_id: 100,
      demand_id: 30,
      total_amount: 15000,
      currency: "CNY",
    })
  })

  await t.test("student confirmation notifies only the parent", async () => {
    activeFixture = createFixture("CONFIRMED")

    await orderService.confirmOrder(STUDENT, 100)

    assert.equal(activeFixture.state.order.status, "IN_PROGRESS")
    assert.equal(activeFixture.state.notifications.length, 1)
    assertNotification(activeFixture.state.notifications[0], {
      type: "ORDER_IN_PROGRESS",
      recipientId: PARENT.id,
      actorId: STUDENT.id,
      actionPath: "/parent/orders",
    })
  })

  await t.test("parent completion notifies only the student", async () => {
    activeFixture = createFixture("IN_PROGRESS")

    await orderService.completeOrder(PARENT, 100)

    assert.equal(activeFixture.state.order.status, "COMPLETED")
    assert.equal(activeFixture.state.demand.status, "COMPLETED")
    assert.equal(activeFixture.state.notifications.length, 1)
    assertNotification(activeFixture.state.notifications[0], {
      type: "ORDER_COMPLETED",
      recipientId: STUDENT.id,
      actorId: PARENT.id,
      actionPath: "/student/orders",
    })
  })

  await t.test("administrator completion notifies both participants with unique keys", async () => {
    activeFixture = createFixture("IN_PROGRESS")

    await orderService.completeOrder(ADMIN, 100)

    assert.equal(activeFixture.state.notifications.length, 2)
    assertNotification(activeFixture.state.notifications[0], {
      type: "ORDER_COMPLETED",
      recipientId: PARENT.id,
      actorId: ADMIN.id,
      actionPath: "/parent/orders",
    })
    assertNotification(activeFixture.state.notifications[1], {
      type: "ORDER_COMPLETED",
      recipientId: STUDENT.id,
      actorId: ADMIN.id,
      actionPath: "/student/orders",
    })
    assert.notEqual(
      activeFixture.state.notifications[0].eventKey,
      activeFixture.state.notifications[1].eventKey,
    )
  })

  for (const scenario of [
    {
      name: "parent cancellation notifies only the student",
      user: PARENT,
      recipients: [STUDENT.id],
    },
    {
      name: "student cancellation notifies only the parent",
      user: STUDENT,
      recipients: [PARENT.id],
    },
    {
      name: "administrator cancellation notifies both participants",
      user: ADMIN,
      recipients: [PARENT.id, STUDENT.id],
    },
  ]) {
    await t.test(scenario.name, async () => {
      activeFixture = createFixture()

      await orderService.cancelOrder(scenario.user, 100, {
        cancellation_reason: "Schedule changed",
      })

      assert.equal(activeFixture.state.order.status, "CANCELLED")
      assert.deepEqual(
        activeFixture.state.notifications.map(({ recipientId }) => recipientId),
        scenario.recipients,
      )
      for (const notification of activeFixture.state.notifications) {
        assertNotification(notification, {
          type: "ORDER_CANCELLED",
          recipientId: notification.recipientId,
          actorId: scenario.user.id,
          actionPath: notification.recipientId === PARENT.id
            ? "/parent/orders"
            : "/student/orders",
        })
        assert.equal(notification.payload.cancellation_reason, "Schedule changed")
        assert.notEqual(notification.recipientId, scenario.user.id)
      }
    })
  }

  await t.test("repeated and concurrent failures do not create duplicate notifications", async () => {
    activeFixture = createFixture("CONFIRMED")
    await orderService.confirmOrder(STUDENT, 100)
    await assertRejectCode(
      () => orderService.confirmOrder(STUDENT, 100),
      "INVALID_ORDER_STATUS",
    )
    assert.equal(activeFixture.state.notifications.length, 1)

    activeFixture = createFixture()
    activeFixture.state.failNextOrderUpdate()
    await assertRejectCode(
      () => orderService.updateTerms(PARENT, 100, { total_amount: 15000 }),
      "ORDER_ALREADY_UPDATED",
    )
    assert.equal(activeFixture.state.order.status, "PENDING")
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  await t.test("notification failure rolls back every order transition and completed demand", async () => {
    const rollbackScenarios = [
      {
        status: "PENDING",
        operation: () => orderService.updateTerms(PARENT, 100, { total_amount: 15000 }),
      },
      {
        status: "CONFIRMED",
        operation: () => orderService.confirmOrder(STUDENT, 100),
      },
      {
        status: "PENDING",
        operation: () => orderService.cancelOrder(PARENT, 100, {
          cancellation_reason: "Schedule changed",
        }),
      },
      {
        status: "IN_PROGRESS",
        operation: () => orderService.completeOrder(PARENT, 100),
      },
    ]

    for (const scenario of rollbackScenarios) {
      activeFixture = createFixture(scenario.status)
      activeFixture.state.failNextNotification()

      await assert.rejects(scenario.operation, /notification write failed/)

      assert.equal(activeFixture.state.order.status, scenario.status)
      assert.equal(activeFixture.state.notifications.length, 0)
      if (scenario.status === "IN_PROGRESS") {
        assert.equal(activeFixture.state.order.completedAt, null)
        assert.equal(activeFixture.state.demand.status, "MATCHED")
        assert.equal(activeFixture.state.demand.completedAt, null)
      }
    }
  })
})
