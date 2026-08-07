const assert = require("node:assert/strict")
const { test } = require("node:test")

const future = new Date("2099-01-01T00:00:00.000Z")
const past = new Date("2000-01-01T00:00:00.000Z")

function demand(overrides) {
  return {
    id: 1,
    parentId: 10,
    title: "Available tutoring demand",
    childGrade: "Grade 8",
    subject: "MATH",
    region: "Shanghai",
    scheduleDescription: "Weekend",
    budgetMin: 10000,
    budgetMax: 18000,
    priceUnit: "PER_HOUR",
    currency: "CNY",
    description: null,
    addressDetail: null,
    status: "RECRUITING",
    visibilityStatus: "VISIBLE",
    expiresAt: future,
    parent: { role: "PARENT", status: "ACTIVE" },
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    matchedAt: null,
    completedAt: null,
    closedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  }
}

function matchesWhere(record, where = {}) {
  if (where.id !== undefined && record.id !== where.id) return false
  if (where.parentId !== undefined && record.parentId !== where.parentId) return false
  if (where.status !== undefined && record.status !== where.status) return false
  if (
    where.visibilityStatus !== undefined &&
    record.visibilityStatus !== where.visibilityStatus
  ) return false
  if (where.subject !== undefined && record.subject !== where.subject) return false
  if (where.region !== undefined && record.region !== where.region) return false

  if (where.parent?.is) {
    if (record.parent.role !== where.parent.is.role) return false
    if (record.parent.status !== where.parent.is.status) return false
  }

  if (where.expiresAt === null && record.expiresAt !== null) return false
  if (
    where.expiresAt?.gt &&
    (record.expiresAt === null || record.expiresAt <= where.expiresAt.gt)
  ) return false

  if (where.OR && !where.OR.some((condition) => matchesWhere(record, condition))) {
    return false
  }

  return true
}

function project(record, select) {
  if (!select) return structuredClone(record)

  return Object.fromEntries(
    Object.entries(record).filter(([key]) => select[key] === true),
  )
}

function createFakePrisma() {
  const demands = [
    demand({ id: 1 }),
    demand({ id: 2, visibilityStatus: "HIDDEN" }),
    demand({ id: 3, expiresAt: past }),
    demand({ id: 4, parent: { role: "PARENT", status: "SUSPENDED" } }),
    demand({ id: 5, parent: { role: "PARENT", status: "DISABLED" } }),
    demand({ id: 6, parent: { role: "STUDENT", status: "ACTIVE" } }),
    demand({ id: 7, status: "CLOSED" }),
  ]
  const applications = []
  const notifications = []

  const findFirst = async ({ where, select }) => {
    const record = demands.find((item) => matchesWhere(item, where))
    return record ? project(record, select) : null
  }

  const transaction = {
    demand: { findFirst },
    application: {
      create: async ({ data }) => {
        const record = {
          id: applications.length + 100,
          viewedAt: null,
          decidedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...structuredClone(data),
        }
        applications.push(record)
        return {
          ...structuredClone(record),
          demand: structuredClone(
            demands.find((item) => item.id === record.demandId),
          ),
        }
      },
    },
    notification: {
      upsert: async ({ where, create }) => {
        const existing = notifications.find(
          (item) => item.eventKey === where.eventKey,
        )
        if (existing) return structuredClone(existing)

        const record = {
          id: notifications.length + 200,
          actorId: null,
          resourceType: null,
          resourceId: null,
          actionPath: null,
          payload: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...structuredClone(create),
        }
        notifications.push(record)
        return structuredClone(record)
      },
    },
  }

  return {
    prisma: {
      demand: {
        findFirst,
        findMany: async ({ where }) => demands
          .filter((item) => matchesWhere(item, where))
          .map((item) => structuredClone(item)),
        findUnique: async ({ where, select }) => {
          const record = demands.find((item) => item.id === where.id)
          return record ? project(record, select) : null
        },
      },
      certification: {
        findFirst: async () => ({ status: "APPROVED" }),
      },
      $transaction: async (operation) => operation(transaction),
    },
    state: { applications, notifications },
  }
}

test("students only browse and apply to currently available demands", async (t) => {
  const { prisma, state } = createFakePrisma()
  const prismaPath = require.resolve("../src/prisma/client")
  const notificationServicePath = require.resolve("../src/services/notificationService")
  const applicationServicePath = require.resolve("../src/services/applicationService")
  const demandServicePath = require.resolve("../src/services/demandService")
  const originalPrismaModule = require.cache[prismaPath]

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prisma,
  }
  delete require.cache[notificationServicePath]
  delete require.cache[applicationServicePath]
  delete require.cache[demandServicePath]

  t.after(() => {
    delete require.cache[notificationServicePath]
    delete require.cache[applicationServicePath]
    delete require.cache[demandServicePath]
    if (originalPrismaModule) {
      require.cache[prismaPath] = originalPrismaModule
    } else {
      delete require.cache[prismaPath]
    }
  })

  const applicationService = require(applicationServicePath)
  const demandService = require(demandServicePath)

  const visible = await demandService.getPublicDemands({})
  assert.deepEqual(visible.map((item) => item.id), [1])

  const detail = await demandService.getDemandDetail(1, 20)
  assert.equal(detail.id, 1)
  await assert.rejects(
    demandService.getDemandDetail(2, 20),
    (error) => error.statusCode === 404 && error.code === "DEMAND_NOT_FOUND",
  )

  const submitted = await applicationService.submitApplication(20, 1, {
    cover_message: "I can help with this subject",
  })
  assert.equal(submitted.demand_id, 1)

  for (const demandId of [2, 3, 4, 5, 6]) {
    await assert.rejects(
      applicationService.submitApplication(20, demandId, {
        cover_message: "Direct ID application must be rejected",
      }),
      (error) => error.statusCode === 409 && error.code === "DEMAND_NOT_AVAILABLE",
    )
  }

  await assert.rejects(
    applicationService.submitApplication(20, 7, {
      cover_message: "Closed demand application",
    }),
    (error) => error.statusCode === 409 && error.code === "DEMAND_NOT_RECRUITING",
  )

  assert.equal(state.applications.length, 1)
  assert.equal(state.notifications.length, 1)
})
