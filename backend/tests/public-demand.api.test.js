require("dotenv").config()

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")

const originalFindFirst = prisma.demand.findFirst
const originalFindMany = prisma.demand.findMany

let baseUrl
let server
let records = []
let lastFindFirstQuery
let lastFindManyQuery

function publicRecord(overrides = {}) {
  return {
    id: 1,
    parentId: 99,
    title: "初二数学周末辅导",
    childGrade: "初二",
    subject: "MATH",
    region: "上海市浦东新区",
    addressDetail: "敏感详细地址 101 室",
    scheduleDescription: "每周六下午",
    budgetMin: 10000,
    budgetMax: 18000,
    priceUnit: "PER_HOUR",
    currency: "CNY",
    description: "完整描述包含微信、QQ、手机号和邮箱，不得公开",
    publicSummary: "需要有初中数学辅导经验",
    status: "RECRUITING",
    visibilityStatus: "VISIBLE",
    isFeatured: false,
    sortWeight: 0,
    featuredAt: null,
    featuredUntil: null,
    publishedAt: new Date("2026-07-30T00:00:00.000Z"),
    expiresAt: null,
    listedAt: new Date("2026-07-30T00:00:00.000Z"),
    phone: "13800000000",
    email: "parent-private@example.com",
    wechat: "private-wechat",
    qq: "123456",
    internalNote: "internal only",
    parent: {
      id: 99,
      role: "PARENT",
      status: "ACTIVE",
      email: "parent-private@example.com",
      phone: "13800000000",
    },
    ...overrides,
  }
}

function matchesPublicWhere(record, where) {
  if (where.id !== undefined && record.id !== where.id) return false
  if (where.status !== undefined && record.status !== where.status) return false
  if (
    where.visibilityStatus !== undefined &&
    record.visibilityStatus !== where.visibilityStatus
  ) return false
  if (where.isFeatured !== undefined && record.isFeatured !== where.isFeatured) return false
  if (where.subject !== undefined && record.subject !== where.subject) return false
  if (where.region !== undefined && record.region !== where.region) return false
  if (where.parent?.is?.role && record.parent.role !== where.parent.is.role) return false
  if (where.parent?.is?.status && record.parent.status !== where.parent.is.status) return false

  if (where.OR) {
    const expirationMatches = where.OR.some((condition) => {
      if (condition.expiresAt === null) return record.expiresAt === null
      if (condition.expiresAt?.gt) {
        return record.expiresAt !== null && record.expiresAt > condition.expiresAt.gt
      }
      return false
    })
    if (!expirationMatches) return false
  }

  for (const condition of where.AND || []) {
    if (condition.OR) {
      const isFeatureStartCondition = condition.OR.some(
        (part) => Object.hasOwn(part, "featuredAt"),
      )
      if (isFeatureStartCondition) {
        const featureStartMatches = condition.OR.some((part) => {
          if (part.featuredAt === null) return record.featuredAt === null
          if (part.featuredAt?.lte) {
            return record.featuredAt !== null && record.featuredAt <= part.featuredAt.lte
          }
          return false
        })
        if (!featureStartMatches) return false
        continue
      }

      const featureExpirationMatches = condition.OR.some((part) => {
        if (part.featuredUntil === null) return record.featuredUntil === null
        if (part.featuredUntil?.gt) {
          return record.featuredUntil !== null && record.featuredUntil > part.featuredUntil.gt
        }
        return false
      })
      if (!featureExpirationMatches) return false
    }
  }

  return true
}

function project(record, select) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => select[key] === true),
  )
}

before(async () => {
  prisma.demand.findMany = async (query) => {
    lastFindManyQuery = query
    return records
      .filter((record) => matchesPublicWhere(record, query.where))
      .slice(query.skip, query.skip + query.take)
      .map((record) => project(record, query.select))
  }

  prisma.demand.findFirst = async (query) => {
    lastFindFirstQuery = query
    const record = records.find((item) => matchesPublicWhere(item, query.where))
    return record ? project(record, query.select) : null
  }

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.demand.findFirst = originalFindFirst
  prisma.demand.findMany = originalFindMany

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) return reject(error)
      resolve()
    })
  })
})

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`)
  return {
    status: response.status,
    body: await response.json(),
  }
}

test("visitor can list only visible, recruiting, unexpired demands from active parents", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

  records = [
    publicRecord({ id: 1, expiresAt: null }),
    publicRecord({ id: 2, expiresAt: future }),
    publicRecord({ id: 3, visibilityStatus: "HIDDEN" }),
    publicRecord({ id: 4, status: "CLOSED" }),
    publicRecord({ id: 5, expiresAt: past }),
    publicRecord({ id: 6, parent: { id: 100, status: "SUSPENDED" } }),
  ]

  const response = await request("/api/v1/public/demands")

  assert.equal(response.status, 200)
  assert.deepEqual(response.body.demands.map((demand) => demand.id), [1, 2])
  assert.equal(response.body.pagination.returned, 2)
  assert.equal(lastFindManyQuery.where.status, "RECRUITING")
  assert.equal(lastFindManyQuery.where.visibilityStatus, "VISIBLE")
  assert.equal(lastFindManyQuery.where.parent.is.role, "PARENT")
  assert.equal(lastFindManyQuery.where.parent.is.status, "ACTIVE")
  assert.ok(lastFindManyQuery.where.OR.some((condition) => condition.expiresAt === null))
})

test("demand published by an active non-PARENT user is not public", async () => {
  records = [
    publicRecord({ id: 7 }),
    publicRecord({
      id: 8,
      parent: {
        id: 101,
        role: "STUDENT",
        status: "ACTIVE",
        email: "student-owner@test.invalid",
      },
    }),
  ]

  const response = await request("/api/v1/public/demands")

  assert.equal(response.status, 200)
  assert.deepEqual(response.body.demands.map((demand) => demand.id), [7])
  assert.equal(lastFindManyQuery.where.parent.is.role, "PARENT")
})

test("hidden demand is not available from the public detail endpoint", async () => {
  records = [publicRecord({ id: 10, visibilityStatus: "HIDDEN" })]

  const response = await request("/api/v1/public/demands/10")

  assert.equal(response.status, 404)
  assert.equal(response.body.error.code, "PUBLIC_DEMAND_NOT_FOUND")
  assert.equal(lastFindFirstQuery.where.status, "RECRUITING")
  assert.equal(lastFindFirstQuery.where.visibilityStatus, "VISIBLE")
  assert.equal(lastFindFirstQuery.where.parent.is.status, "ACTIVE")
})

test("closed, expired, and suspended-parent demands are not publicly addressable", async () => {
  const past = new Date(Date.now() - 60 * 1000)
  records = [
    publicRecord({ id: 20, status: "CLOSED" }),
    publicRecord({ id: 21, expiresAt: past }),
    publicRecord({ id: 22, parent: { id: 101, status: "SUSPENDED" } }),
  ]

  for (const id of [20, 21, 22]) {
    const response = await request(`/api/v1/public/demands/${id}`)
    assert.equal(response.status, 404)
  }
})

test("featured endpoint requires active feature and applies the public filters", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const futureStart = new Date(Date.now() + 60 * 60 * 1000)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
  records = [
    publicRecord({ id: 30, isFeatured: true, featuredUntil: future }),
    publicRecord({ id: 31, isFeatured: false }),
    publicRecord({ id: 32, isFeatured: true, featuredUntil: past }),
    publicRecord({ id: 33, isFeatured: true, visibilityStatus: "HIDDEN" }),
    publicRecord({ id: 34, isFeatured: true, featuredAt: futureStart, featuredUntil: future }),
  ]

  const response = await request("/api/v1/public/demands/featured")

  assert.equal(response.status, 200)
  assert.deepEqual(response.body.demands.map((demand) => demand.id), [30])
  assert.equal(lastFindManyQuery.where.isFeatured, true)
  assert.ok(
    lastFindManyQuery.where.AND.some((condition) =>
      condition.OR?.some((part) => part.featuredAt?.lte instanceof Date),
    ),
  )
})

test("public DTO never exposes sensitive or internal demand fields", async () => {
  records = [publicRecord({ id: 40 })]

  const response = await request("/api/v1/public/demands/40")

  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(response.body.demand).sort(), [
    "budget_max",
    "budget_min",
    "child_grade",
    "currency",
    "expires_at",
    "id",
    "is_featured",
    "price_unit",
    "public_summary",
    "published_at",
    "region",
    "schedule_description",
    "subject",
    "title",
  ])

  for (const forbidden of [
    "parentId",
    "parent_id",
    "parent",
    "addressDetail",
    "address_detail",
    "description",
    "phone",
    "email",
    "wechat",
    "qq",
    "internalNote",
    "visibilityStatus",
    "sortWeight",
    "featuredAt",
  ]) {
    assert.equal(forbidden in response.body.demand, false, `${forbidden} leaked`)
    assert.equal(lastFindFirstQuery.select[forbidden], undefined)
  }
})
