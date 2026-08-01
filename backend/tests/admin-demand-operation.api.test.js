require("dotenv").config()

const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")
const { signToken } = require("../src/utils/jwt")

const DAY_MS = 24 * 60 * 60 * 1000

const originals = {
  transaction: prisma.$transaction,
  demandCount: prisma.demand.count,
  demandFindMany: prisma.demand.findMany,
  demandFindUnique: prisma.demand.findUnique,
  logCount: prisma.adminOperationLog.count,
  logFindMany: prisma.adminOperationLog.findMany,
  userFindUnique: prisma.user.findUnique,
}

const users = {
  1: { id: 1, email: "admin@test.com", role: "ADMIN", status: "ACTIVE", displayName: "测试管理员" },
  2: { id: 2, email: "student@test.com", role: "STUDENT", status: "ACTIVE", displayName: "测试学生" },
}

let baseUrl
let server
let demands = []
let logs = []
let failNextLogWrite = false
let lastListQuery

function parent(overrides = {}) {
  return {
    id: 10,
    displayName: "测试家长",
    email: "parent@test.com",
    role: "PARENT",
    status: "ACTIVE",
    ...overrides,
  }
}

function demand(overrides = {}) {
  const now = Date.now()
  return {
    id: 100,
    parentId: 10,
    title: "初二数学辅导",
    childGrade: "初二",
    subject: "MATH",
    region: "浦东新区",
    status: "RECRUITING",
    visibilityStatus: "HIDDEN",
    publicSummary: null,
    isFeatured: false,
    sortWeight: 0,
    featuredAt: null,
    featuredUntil: null,
    expiresAt: null,
    listedAt: null,
    unlistedAt: null,
    viewCount: 0,
    publishedAt: new Date(now - DAY_MS),
    createdAt: new Date(now - 2 * DAY_MS),
    updatedAt: new Date(now - DAY_MS),
    parent: parent(),
    _count: { applications: 2 },
    ...overrides,
  }
}

function matchesAdminWhere(item, where) {
  if (where.status && item.status !== where.status) return false
  if (where.visibilityStatus && item.visibilityStatus !== where.visibilityStatus) return false
  if (where.subject && item.subject !== where.subject) return false
  if (where.region && item.region !== where.region) return false
  if (where.isFeatured !== undefined && item.isFeatured !== where.isFeatured) return false
  if (where.expiresAt?.lte && (!item.expiresAt || item.expiresAt > where.expiresAt.lte)) return false

  for (const condition of where.AND || []) {
    if (!condition.OR) continue
    const isExpiryCondition = condition.OR.some((part) => Object.hasOwn(part, "expiresAt"))
    if (isExpiryCondition) {
      const matches = condition.OR.some((part) => {
        if (part.expiresAt === null) return item.expiresAt === null
        return item.expiresAt !== null && item.expiresAt > part.expiresAt.gt
      })
      if (!matches) return false
      continue
    }
    const matches = condition.OR.some((part) => {
      const search = part.title?.contains ||
        part.parent?.is?.displayName?.contains ||
        part.parent?.is?.email?.contains
      if (!search) return false
      return [item.title, item.parent.displayName, item.parent.email]
        .some((value) => value.toLowerCase().includes(search.toLowerCase()))
    })
    if (!matches) return false
  }
  return true
}

function installPrismaFakes() {
  prisma.user.findUnique = async ({ where }) => users[where.id] || null
  prisma.demand.count = async ({ where }) => demands.filter((item) => matchesAdminWhere(item, where)).length
  prisma.demand.findMany = async (query) => {
    lastListQuery = query
    return demands
      .filter((item) => matchesAdminWhere(item, query.where))
      .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
      .slice(query.skip, query.skip + query.take)
  }
  prisma.demand.findUnique = async ({ where }) => {
    const item = demands.find((candidate) => candidate.id === where.id)
    return item ? structuredClone(item) : null
  }
  prisma.adminOperationLog.count = async ({ where }) => logs.filter(
    (log) => log.targetType === where.targetType && log.targetId === where.targetId,
  ).length
  prisma.adminOperationLog.findMany = async ({ where, skip, take }) => logs
    .filter((log) => log.targetType === where.targetType && log.targetId === where.targetId)
    .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
    .slice(skip, skip + take)
    .map((log) => ({ ...structuredClone(log), admin: { id: 1, displayName: "测试管理员" } }))

  prisma.$transaction = async (callback) => {
    const stagedDemands = structuredClone(demands)
    const stagedLogs = structuredClone(logs)
    const transaction = {
      demand: {
        findUnique: async ({ where }) => {
          const item = stagedDemands.find((candidate) => candidate.id === where.id)
          return item ? structuredClone(item) : null
        },
        update: async ({ where, data }) => {
          const item = stagedDemands.find((candidate) => candidate.id === where.id)
          if (!item) throw new Error("fake demand missing")
          Object.assign(item, data, { updatedAt: new Date() })
          return structuredClone(item)
        },
      },
      adminOperationLog: {
        create: async ({ data }) => {
          if (failNextLogWrite) {
            failNextLogWrite = false
            throw new Error("simulated log write failure")
          }
          const log = {
            id: stagedLogs.length + 1,
            createdAt: new Date(),
            ...structuredClone(data),
          }
          stagedLogs.push(log)
          return structuredClone(log)
        },
      },
    }

    const result = await callback(transaction)
    demands = stagedDemands
    logs = stagedLogs
    return result
  }
}

before(async () => {
  installPrismaFakes()
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.$transaction = originals.transaction
  prisma.demand.count = originals.demandCount
  prisma.demand.findMany = originals.demandFindMany
  prisma.demand.findUnique = originals.demandFindUnique
  prisma.adminOperationLog.count = originals.logCount
  prisma.adminOperationLog.findMany = originals.logFindMany
  prisma.user.findUnique = originals.userFindUnique
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

function tokenFor(user) {
  return signToken(user)
}

async function request(path, { token = tokenFor(users[1]), method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: response.status, body: await response.json() }
}

test("non-admin receives 403", async () => {
  demands = [demand()]
  const response = await request("/api/v1/admin/demands", {
    token: tokenFor(users[2]),
  })
  assert.equal(response.status, 403)
})

test("invalid DEFAULT_DEMAND_EXPIRE_DAYS fails with an explicit configuration error", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "require('./src/utils/runtimeConfig')"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DEFAULT_DEMAND_EXPIRE_DAYS: "0" },
    },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DEFAULT_DEMAND_EXPIRE_DAYS must be a positive integer/)
})

test("admin demand list supports pagination and filters", async () => {
  demands = [
    demand({ id: 101, title: "数学一", visibilityStatus: "VISIBLE", isFeatured: true }),
    demand({ id: 102, title: "数学二", visibilityStatus: "VISIBLE", isFeatured: true }),
    demand({ id: 103, title: "英语", subject: "ENGLISH" }),
  ]
  const response = await request(
    "/api/v1/admin/demands?page=1&page_size=1&search=数学&status=RECRUITING&visibility_status=VISIBLE&is_featured=true&subject=MATH&region=浦东新区&expired=false",
  )
  assert.equal(response.status, 200)
  assert.equal(response.body.demands.length, 1)
  assert.equal(response.body.pagination.total, 2)
  assert.equal(response.body.pagination.total_pages, 2)
  assert.equal(lastListQuery.take, 1)
  assert.equal(lastListQuery.where.visibilityStatus, "VISIBLE")
  assert.equal(lastListQuery.where.isFeatured, true)
})

test("draft, matched, and completed demands cannot be listed", async () => {
  demands = [
    demand({ id: 110, status: "DRAFT" }),
    demand({ id: 111, status: "MATCHED" }),
    demand({ id: 112, status: "COMPLETED" }),
  ]
  for (const id of [110, 111, 112]) {
    const response = await request(`/api/v1/admin/demands/${id}/visibility`, {
      method: "PATCH",
      body: {
        visibility_status: "VISIBLE",
        public_summary: "安全公开摘要",
        reason: "审核",
      },
    })
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, "DEMAND_NOT_LISTABLE")
  }
})

test("demand from suspended parent cannot be listed", async () => {
  demands = [demand({ id: 120, parent: parent({ status: "SUSPENDED" }) })]
  const response = await request("/api/v1/admin/demands/120/visibility", {
    method: "PATCH",
    body: {
      visibility_status: "VISIBLE",
      public_summary: "安全公开摘要",
      reason: "审核",
    },
  })
  assert.equal(response.status, 409)
  assert.equal(response.body.error.code, "DEMAND_PARENT_NOT_ACTIVE")
})

test("listing requires a summary and valid future expiry", async () => {
  demands = [demand({ id: 130 })]
  const missingSummary = await request("/api/v1/admin/demands/130/visibility", {
    method: "PATCH",
    body: { visibility_status: "VISIBLE", reason: "审核" },
  })
  assert.equal(missingSummary.status, 400)
  assert.equal(missingSummary.body.error.code, "PUBLIC_SUMMARY_REQUIRED")

  const invalidExpiry = await request("/api/v1/admin/demands/130/visibility", {
    method: "PATCH",
    body: {
      visibility_status: "VISIBLE",
      public_summary: "安全公开摘要",
      expires_at: new Date(Date.now() - DAY_MS).toISOString(),
      reason: "审核",
    },
  })
  assert.equal(invalidExpiry.status, 400)
  assert.equal(invalidExpiry.body.error.code, "INVALID_OPERATION_DATE")
})

test("listing uses configured default expiry and writes a limited operation log", async () => {
  demands = [demand({ id: 140 })]
  logs = []
  const before = Date.now()
  const response = await request("/api/v1/admin/demands/140/visibility", {
    method: "PATCH",
    body: {
      visibility_status: "VISIBLE",
      public_summary: "  已脱敏公开摘要  ",
      reason: "  人工审核通过  ",
    },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.demand.visibility_status, "VISIBLE")
  assert.equal(response.body.demand.public_summary, "已脱敏公开摘要")
  const expiry = new Date(response.body.demand.expires_at).getTime()
  assert.ok(expiry >= before + 30 * DAY_MS)
  assert.ok(expiry <= Date.now() + 30 * DAY_MS + 2000)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].action, "DEMAND_LIST")
  assert.equal(logs[0].targetType, "DEMAND")
  assert.equal(logs[0].reason, "人工审核通过")
  assert.equal("parent" in logs[0].beforeData, false)
})

test("unlisting cancels feature and writes log", async () => {
  const future = new Date(Date.now() + 5 * DAY_MS)
  demands = [demand({
    id: 150,
    visibilityStatus: "VISIBLE",
    publicSummary: "摘要",
    isFeatured: true,
    sortWeight: 80,
    featuredAt: new Date(),
    featuredUntil: future,
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
  })]
  logs = []
  const response = await request("/api/v1/admin/demands/150/visibility", {
    method: "PATCH",
    body: { visibility_status: "HIDDEN", reason: "内容需要复审" },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.demand.visibility_status, "HIDDEN")
  assert.equal(response.body.demand.is_featured, false)
  assert.equal(response.body.demand.sort_weight, 0)
  assert.equal(response.body.demand.featured_at, null)
  assert.equal(response.body.demand.featured_until, null)
  assert.equal(logs[0].action, "DEMAND_UNLIST")
})

test("hidden demand cannot be featured", async () => {
  demands = [demand({ id: 160, visibilityStatus: "HIDDEN" })]
  const response = await request("/api/v1/admin/demands/160/feature", {
    method: "PATCH",
    body: {
      is_featured: true,
      sort_weight: 10,
      featured_until: new Date(Date.now() + DAY_MS).toISOString(),
      reason: "推荐",
    },
  })
  assert.equal(response.status, 409)
  assert.equal(response.body.error.code, "DEMAND_NOT_VISIBLE")
})

test("feature window is validated and cannot exceed demand expiry", async () => {
  const expiry = new Date(Date.now() + 3 * DAY_MS)
  demands = [demand({ id: 170, visibilityStatus: "VISIBLE", expiresAt: expiry })]
  const featuredAt = new Date(Date.now() + 2 * DAY_MS)
  const invalidWindow = await request("/api/v1/admin/demands/170/feature", {
    method: "PATCH",
    body: {
      is_featured: true,
      sort_weight: 10,
      featured_at: featuredAt.toISOString(),
      featured_until: new Date(Date.now() + DAY_MS).toISOString(),
      reason: "推荐",
    },
  })
  assert.equal(invalidWindow.status, 400)
  assert.equal(invalidWindow.body.error.code, "INVALID_FEATURE_WINDOW")

  const exceedsExpiry = await request("/api/v1/admin/demands/170/feature", {
    method: "PATCH",
    body: {
      is_featured: true,
      sort_weight: 10,
      featured_until: new Date(Date.now() + 4 * DAY_MS).toISOString(),
      reason: "推荐",
    },
  })
  assert.equal(exceedsExpiry.status, 400)
  assert.equal(exceedsExpiry.body.error.code, "FEATURE_EXCEEDS_DEMAND_EXPIRY")
})

test("feature and unfeature both write operation logs", async () => {
  demands = [demand({
    id: 180,
    visibilityStatus: "VISIBLE",
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
  })]
  logs = []
  const featured = await request("/api/v1/admin/demands/180/feature", {
    method: "PATCH",
    body: {
      is_featured: true,
      sort_weight: 90,
      featured_until: new Date(Date.now() + 5 * DAY_MS).toISOString(),
      reason: "首页推荐",
    },
  })
  assert.equal(featured.status, 200)
  assert.equal(featured.body.demand.is_featured, true)
  assert.equal(logs[0].action, "DEMAND_FEATURE")

  const unfeatured = await request("/api/v1/admin/demands/180/feature", {
    method: "PATCH",
    body: { is_featured: false, reason: "结束推荐" },
  })
  assert.equal(unfeatured.status, 200)
  assert.equal(unfeatured.body.demand.is_featured, false)
  assert.equal(logs[1].action, "DEMAND_UNFEATURE")
})

test("expiry update writes log and consistently cancels an overlong feature", async () => {
  demands = [demand({
    id: 190,
    visibilityStatus: "VISIBLE",
    isFeatured: true,
    sortWeight: 50,
    featuredAt: new Date(),
    featuredUntil: new Date(Date.now() + 8 * DAY_MS),
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
  })]
  logs = []
  const newExpiry = new Date(Date.now() + 4 * DAY_MS)
  const response = await request("/api/v1/admin/demands/190/expiry", {
    method: "PATCH",
    body: { expires_at: newExpiry.toISOString(), reason: "调整有效期" },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.demand.visibility_status, "VISIBLE")
  assert.equal(response.body.demand.is_featured, false)
  assert.equal(response.body.demand.featured_until, null)
  assert.equal(logs[0].action, "DEMAND_EXPIRY_UPDATE")
})

test("extending an expired hidden demand does not list it automatically", async () => {
  demands = [demand({
    id: 195,
    visibilityStatus: "HIDDEN",
    expiresAt: new Date(Date.now() - DAY_MS),
  })]
  logs = []
  const response = await request("/api/v1/admin/demands/195/expiry", {
    method: "PATCH",
    body: {
      expires_at: new Date(Date.now() + 5 * DAY_MS).toISOString(),
      reason: "延长审核期",
    },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.demand.visibility_status, "HIDDEN")
  assert.equal(logs[0].action, "DEMAND_EXPIRY_UPDATE")
})

test("transaction rolls back demand when operation-log write fails", async () => {
  demands = [demand({ id: 200 })]
  logs = []
  failNextLogWrite = true
  const originalConsoleError = console.error
  console.error = () => {}
  let response
  try {
    response = await request("/api/v1/admin/demands/200/visibility", {
      method: "PATCH",
      body: {
        visibility_status: "VISIBLE",
        public_summary: "安全摘要",
        reason: "模拟事务失败",
      },
    })
  } finally {
    console.error = originalConsoleError
  }
  assert.equal(response.status, 500)
  assert.equal(demands[0].visibilityStatus, "HIDDEN")
  assert.equal(logs.length, 0)
})

test("operation logs are paginated and sorted by createdAt then id descending", async () => {
  demands = [demand({ id: 210 })]
  const sameTime = new Date()
  logs = [
    { id: 1, adminId: 1, action: "DEMAND_LIST", targetType: "DEMAND", targetId: 210, beforeData: {}, afterData: {}, reason: "一", createdAt: new Date(sameTime - 1000) },
    { id: 2, adminId: 1, action: "DEMAND_UNLIST", targetType: "DEMAND", targetId: 210, beforeData: {}, afterData: {}, reason: "二", createdAt: sameTime },
    { id: 3, adminId: 1, action: "DEMAND_LIST", targetType: "DEMAND", targetId: 210, beforeData: {}, afterData: {}, reason: "三", createdAt: sameTime },
  ]
  const response = await request("/api/v1/admin/demands/210/operation-logs?page=1&page_size=2")
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.logs.map((log) => log.id), [3, 2])
  assert.equal(response.body.pagination.total, 3)
  assert.equal(response.body.pagination.total_pages, 2)
})
