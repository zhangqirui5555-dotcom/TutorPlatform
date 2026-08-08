const assert = require("node:assert/strict")
const { test } = require("node:test")

const PARENT_ID = 10
const STUDENT_ID = 20

function createFixture({
  trialStatus = null,
  proposedBy = STUDENT_ID,
  orderId = 60,
  scheduledStartAt = new Date("2026-08-06T01:00:00.000Z"),
  scheduledEndAt = new Date("2026-08-06T02:00:00.000Z"),
} = {}) {
  const now = new Date("2026-08-07T00:00:00.000Z")
  const application = {
    id: 40,
    studentId: STUDENT_ID,
    status: "ACCEPTED",
    demand: {
      id: 30,
      parentId: PARENT_ID,
    },
    order: orderId === null ? null : { id: orderId },
  }
  const notifications = []
  const trialLessons = trialStatus
    ? [{
        id: 50,
        applicationId: application.id,
        orderId,
        demandId: application.demand.id,
        parentId: PARENT_ID,
        studentId: STUDENT_ID,
        proposedBy,
        scheduledStartAt,
        scheduledEndAt,
        method: "ONLINE",
        locationOrLink: "https://example.test/trial",
        status: trialStatus,
        cancellationReason: null,
        confirmedAt: trialStatus === "CONFIRMED" ? now : null,
        completedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      }]
    : []
  let failNextNotification = false
  let failNextUpdate = false

  function trialLessonRecord(trialLesson) {
    return {
      ...trialLesson,
      demand: {
        id: application.demand.id,
        title: "Math tutor",
        subject: "MATH",
        region: "Shanghai",
        status: "MATCHED",
      },
      parent: {
        id: PARENT_ID,
        email: "parent@test.com",
        displayName: "Parent",
        role: "PARENT",
      },
      student: {
        id: STUDENT_ID,
        email: "student@test.com",
        displayName: "Student",
        role: "STUDENT",
      },
    }
  }

  const transaction = {
    application: {
      findUnique: async ({ where }) => (
        where.id === application.id ? application : null
      ),
    },
    trialLesson: {
      create: async ({ data }) => {
        const trialLesson = {
          id: 50,
          cancellationReason: null,
          confirmedAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        }
        trialLessons.push(trialLesson)
        return trialLessonRecord(trialLesson)
      },
      findUnique: async ({ where }) => {
        const trialLesson = trialLessons.find(({ id }) => id === where.id)
        return trialLesson ? trialLessonRecord(trialLesson) : null
      },
      updateMany: async ({ where, data }) => {
        if (failNextUpdate) {
          failNextUpdate = false
          return { count: 0 }
        }

        const trialLesson = trialLessons.find(({ id }) => id === where.id)
        if (!trialLesson || !where.status.in.includes(trialLesson.status)) {
          return { count: 0 }
        }

        Object.assign(trialLesson, data, { updatedAt: now })
        return { count: 1 }
      },
    },
    notification: {
      upsert: async ({ where, create }) => {
        if (failNextNotification) {
          failNextNotification = false
          throw new Error("notification write failed")
        }

        const existing = notifications.find(
          ({ eventKey }) => eventKey === where.eventKey,
        )
        if (existing) {
          return existing
        }

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
    },
  }

  async function runTransaction(operation) {
    const trialLessonSnapshots = trialLessons.map((trialLesson) => ({ ...trialLesson }))
    const notificationCount = notifications.length

    try {
      return await operation(transaction)
    } catch (error) {
      trialLessons.splice(
        0,
        trialLessons.length,
        ...trialLessonSnapshots.map((trialLesson) => ({ ...trialLesson })),
      )
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
      notifications,
      trialLessons,
      failNextNotification() {
        failNextNotification = true
      },
      failNextUpdate() {
        failNextUpdate = true
      },
    },
  }
}

function createInput() {
  return {
    scheduled_start_at: "2026-08-08T01:00:00.000Z",
    scheduled_end_at: "2026-08-08T02:00:00.000Z",
    method: "ONLINE",
    location_or_link: "https://example.test/trial",
  }
}

function assertNotification(notification, {
  type,
  recipientId,
  actorId,
}) {
  assert.equal(notification.type, type)
  assert.equal(notification.recipientId, recipientId)
  assert.equal(notification.actorId, actorId)
  assert.notEqual(notification.recipientId, notification.actorId)
  assert.equal(notification.resourceType, "TRIAL_LESSON")
  assert.equal(notification.resourceId, 50)
  assert.equal(notification.eventKey, `${type}:50:${recipientId}`)
  assert.equal(
    notification.actionPath,
    recipientId === PARENT_ID
      ? "/parent/trial-lessons"
      : "/student/trial-lessons",
  )
}

async function assertRejectCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, code)
    return true
  })
}

test("TrialLesson writes create transactional participant notifications", async (t) => {
  const prismaPath = require.resolve("../src/prisma/client")
  const notificationServicePath = require.resolve("../src/services/notificationService")
  const trialLessonServicePath = require.resolve("../src/services/trialLessonService")
  const originalPrismaModule = require.cache[prismaPath]
  const originalNotificationServiceModule = require.cache[notificationServicePath]
  const originalTrialLessonServiceModule = require.cache[trialLessonServicePath]
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
  delete require.cache[trialLessonServicePath]

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

    if (originalTrialLessonServiceModule) {
      require.cache[trialLessonServicePath] = originalTrialLessonServiceModule
    } else {
      delete require.cache[trialLessonServicePath]
    }
  })

  const trialLessonService = require(trialLessonServicePath)

  for (const scenario of [
    {
      name: "parent proposal notifies the student and includes its order",
      actorId: PARENT_ID,
      recipientId: STUDENT_ID,
    },
    {
      name: "student proposal notifies the parent and includes its order",
      actorId: STUDENT_ID,
      recipientId: PARENT_ID,
    },
  ]) {
    await t.test(scenario.name, async () => {
      activeFixture = createFixture()

      await trialLessonService.createTrialLesson(
        scenario.actorId,
        40,
        createInput(),
      )

      assert.equal(activeFixture.state.trialLessons.length, 1)
      assert.equal(activeFixture.state.trialLessons[0].status, "PENDING_CONFIRMATION")
      assert.equal(activeFixture.state.notifications.length, 1)
      assertNotification(activeFixture.state.notifications[0], {
        type: "TRIAL_LESSON_PROPOSED",
        recipientId: scenario.recipientId,
        actorId: scenario.actorId,
      })
      assert.deepEqual(activeFixture.state.notifications[0].payload, {
        trial_lesson_id: 50,
        application_id: 40,
        demand_id: 30,
        order_id: 60,
        scheduled_at: "2026-08-08T01:00:00.000Z",
      })
    })
  }

  await t.test("historical application without an order still creates a proposal", async () => {
    activeFixture = createFixture({ orderId: null })

    await trialLessonService.createTrialLesson(STUDENT_ID, 40, createInput())

    assert.equal(activeFixture.state.trialLessons[0].orderId, null)
    assert.equal(activeFixture.state.notifications.length, 1)
    assert.equal(
      Object.hasOwn(activeFixture.state.notifications[0].payload, "order_id"),
      false,
    )
  })

  await t.test("the other participant confirms and the proposer is notified", async () => {
    activeFixture = createFixture({
      trialStatus: "PENDING_CONFIRMATION",
      proposedBy: STUDENT_ID,
    })

    await trialLessonService.confirmTrialLesson(PARENT_ID, 50)

    assert.equal(activeFixture.state.trialLessons[0].status, "CONFIRMED")
    assert.equal(activeFixture.state.notifications.length, 1)
    assertNotification(activeFixture.state.notifications[0], {
      type: "TRIAL_LESSON_CONFIRMED",
      recipientId: STUDENT_ID,
      actorId: PARENT_ID,
    })
  })

  await t.test("existing confirmation and participant permissions remain unchanged", async () => {
    activeFixture = createFixture({
      trialStatus: "PENDING_CONFIRMATION",
      proposedBy: STUDENT_ID,
    })
    await assertRejectCode(
      () => trialLessonService.confirmTrialLesson(STUDENT_ID, 50),
      "CONFIRMATION_REQUIRES_OTHER_PARTICIPANT",
    )
    assert.equal(activeFixture.state.trialLessons[0].status, "PENDING_CONFIRMATION")
    assert.equal(activeFixture.state.notifications.length, 0)

    activeFixture = createFixture({ trialStatus: "CONFIRMED" })
    await assertRejectCode(
      () => trialLessonService.completeTrialLesson(999, 50),
      "FORBIDDEN",
    )
    assert.equal(activeFixture.state.trialLessons[0].status, "CONFIRMED")
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  for (const scenario of [
    {
      name: "parent cancellation notifies the student",
      actorId: PARENT_ID,
      recipientId: STUDENT_ID,
    },
    {
      name: "student cancellation notifies the parent",
      actorId: STUDENT_ID,
      recipientId: PARENT_ID,
    },
  ]) {
    await t.test(scenario.name, async () => {
      activeFixture = createFixture({ trialStatus: "CONFIRMED" })

      await trialLessonService.cancelTrialLesson(scenario.actorId, 50, {
        cancellation_reason: "Schedule changed",
      })

      assert.equal(activeFixture.state.trialLessons[0].status, "CANCELLED")
      assert.equal(activeFixture.state.notifications.length, 1)
      assertNotification(activeFixture.state.notifications[0], {
        type: "TRIAL_LESSON_CANCELLED",
        recipientId: scenario.recipientId,
        actorId: scenario.actorId,
      })
      assert.equal(
        activeFixture.state.notifications[0].payload.cancellation_reason,
        "Schedule changed",
      )
    })
  }

  await t.test("completion notifies the other participant without changing an order", async () => {
    activeFixture = createFixture({ trialStatus: "CONFIRMED" })

    await trialLessonService.completeTrialLesson(STUDENT_ID, 50)

    assert.equal(activeFixture.state.trialLessons[0].status, "COMPLETED")
    assert.equal(activeFixture.state.notifications.length, 1)
    assertNotification(activeFixture.state.notifications[0], {
      type: "TRIAL_LESSON_COMPLETED",
      recipientId: PARENT_ID,
      actorId: STUDENT_ID,
    })
    assert.equal(activeFixture.state.notifications[0].payload.order_id, 60)
  })

  await t.test("completion uses the server clock and rejects a lesson before its end", async (t) => {
    t.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-08-08T01:59:59.999Z"),
    })
    activeFixture = createFixture({
      trialStatus: "CONFIRMED",
      scheduledEndAt: new Date("2026-08-08T02:00:00.000Z"),
    })

    await assert.rejects(
      () => trialLessonService.completeTrialLesson(STUDENT_ID, 50),
      (error) => {
        assert.equal(error.statusCode, 409)
        assert.equal(error.code, "TRIAL_LESSON_NOT_ENDED")
        assert.equal(error.message, "试课尚未结束，暂不能标记为完成。")
        return true
      },
    )

    assert.equal(activeFixture.state.trialLessons[0].status, "CONFIRMED")
    assert.equal(activeFixture.state.trialLessons[0].completedAt, null)
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  for (const scenario of [
    {
      name: "completion is allowed exactly at the scheduled end",
      now: "2026-08-08T02:00:00.000Z",
    },
    {
      name: "completion is allowed after the scheduled end",
      now: "2026-08-08T02:00:00.001Z",
    },
  ]) {
    await t.test(scenario.name, async (t) => {
      t.mock.timers.enable({ apis: ["Date"], now: new Date(scenario.now) })
      activeFixture = createFixture({
        trialStatus: "CONFIRMED",
        scheduledEndAt: new Date("2026-08-08T02:00:00.000Z"),
      })

      await trialLessonService.completeTrialLesson(PARENT_ID, 50)

      assert.equal(activeFixture.state.trialLessons[0].status, "COMPLETED")
      assert.equal(
        activeFixture.state.trialLessons[0].completedAt.toISOString(),
        scenario.now,
      )
      assert.equal(activeFixture.state.notifications.length, 1)
    })
  }

  await t.test("an elapsed lesson still requires CONFIRMED status", async (t) => {
    t.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-08-08T03:00:00.000Z"),
    })
    activeFixture = createFixture({
      trialStatus: "PENDING_CONFIRMATION",
      scheduledEndAt: new Date("2026-08-08T02:00:00.000Z"),
    })

    await assertRejectCode(
      () => trialLessonService.completeTrialLesson(PARENT_ID, 50),
      "INVALID_TRIAL_LESSON_STATUS",
    )
    assert.equal(activeFixture.state.trialLessons[0].status, "PENDING_CONFIRMATION")
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  await t.test("repeated and concurrent failures create no duplicate notifications", async () => {
    for (const scenario of [
      {
        status: "PENDING_CONFIRMATION",
        operation: () => trialLessonService.confirmTrialLesson(PARENT_ID, 50),
      },
      {
        status: "CONFIRMED",
        operation: () => trialLessonService.cancelTrialLesson(PARENT_ID, 50, {}),
      },
      {
        status: "CONFIRMED",
        operation: () => trialLessonService.completeTrialLesson(PARENT_ID, 50),
      },
    ]) {
      activeFixture = createFixture({ trialStatus: scenario.status })
      await scenario.operation()
      await assertRejectCode(scenario.operation, "INVALID_TRIAL_LESSON_STATUS")
      assert.equal(activeFixture.state.notifications.length, 1)
    }

    activeFixture = createFixture({ trialStatus: "CONFIRMED" })
    activeFixture.state.failNextUpdate()
    await assertRejectCode(
      () => trialLessonService.completeTrialLesson(PARENT_ID, 50),
      "TRIAL_LESSON_ALREADY_UPDATED",
    )
    assert.equal(activeFixture.state.trialLessons[0].status, "CONFIRMED")
    assert.equal(activeFixture.state.notifications.length, 0)
  })

  await t.test("notification failure rolls back creation and every status transition", async () => {
    const rollbackScenarios = [
      {
        fixture: {},
        originalStatus: null,
        operation: () => trialLessonService.createTrialLesson(
          PARENT_ID,
          40,
          createInput(),
        ),
      },
      {
        fixture: {
          trialStatus: "PENDING_CONFIRMATION",
          proposedBy: STUDENT_ID,
        },
        originalStatus: "PENDING_CONFIRMATION",
        operation: () => trialLessonService.confirmTrialLesson(PARENT_ID, 50),
      },
      {
        fixture: { trialStatus: "CONFIRMED" },
        originalStatus: "CONFIRMED",
        operation: () => trialLessonService.cancelTrialLesson(PARENT_ID, 50, {}),
      },
      {
        fixture: { trialStatus: "CONFIRMED" },
        originalStatus: "CONFIRMED",
        operation: () => trialLessonService.completeTrialLesson(PARENT_ID, 50),
      },
    ]

    for (const scenario of rollbackScenarios) {
      activeFixture = createFixture(scenario.fixture)
      activeFixture.state.failNextNotification()

      await assert.rejects(scenario.operation, /notification write failed/)

      assert.equal(activeFixture.state.notifications.length, 0)
      if (scenario.originalStatus === null) {
        assert.equal(activeFixture.state.trialLessons.length, 0)
      } else {
        assert.equal(activeFixture.state.trialLessons[0].status, scenario.originalStatus)
      }
    }
  })
})
