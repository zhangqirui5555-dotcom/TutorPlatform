require("dotenv").config()

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")

let baseUrl
let server

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  await prisma.$disconnect()
})

async function request(path, { token, ...options } = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    ...options.headers,
  }

  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  })
  const body = await response.json()

  return {
    body,
    status: response.status,
  }
}

test("demand creation enforces parent role and budget rules", async () => {
  const [parentLogin, studentLogin] = await Promise.all([
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "parent@test.com",
        password: "Test123456!",
      }),
    }),
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "student@test.com",
        password: "Test123456!",
      }),
    }),
  ])

  assert.equal(parentLogin.status, 200)
  assert.equal(studentLogin.status, 200)

  const baseDemand = {
    title: "Validation test demand",
    child_grade: "初二",
    subject: "MATH",
    region: "DEMO_REGION",
    schedule_description: "周末下午",
    budget_min: 10000,
    budget_max: 18000,
  }

  const forbidden = await request("/api/v1/demands", {
    method: "POST",
    token: studentLogin.body.token,
    body: JSON.stringify(baseDemand),
  })
  assert.equal(forbidden.status, 403)

  const negativeBudget = await request("/api/v1/demands", {
    method: "POST",
    token: parentLogin.body.token,
    body: JSON.stringify({
      ...baseDemand,
      budget_min: -1,
    }),
  })
  assert.equal(negativeBudget.status, 400)
  assert.equal(negativeBudget.body.error.code, "INVALID_BUDGET")

  const reversedBudget = await request("/api/v1/demands", {
    method: "POST",
    token: parentLogin.body.token,
    body: JSON.stringify({
      ...baseDemand,
      budget_min: 20000,
      budget_max: 10000,
    }),
  })
  assert.equal(reversedBudget.status, 400)
  assert.equal(reversedBudget.body.error.code, "INVALID_BUDGET_RANGE")
})

test("parent can create, query, publish, and close a demand", async () => {
  const [login, studentLogin] = await Promise.all([
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "parent@test.com",
        password: "Test123456!",
      }),
    }),
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "student@test.com",
        password: "Test123456!",
      }),
    }),
  ])

  assert.equal(login.status, 200)
  assert.equal(studentLogin.status, 200)
  assert.ok(login.body.token)

  const token = login.body.token
  const marker = Date.now()
  const subject = `DEMO_SUBJECT_${marker}`
  const region = `DEMO_REGION_${marker}`
  const utf8Title = `UTF-8 中文家教需求 ${marker}`
  const utf8Description = "中文内容应当被完整保存和读取"

  const created = await request("/api/v1/demands", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: utf8Title,
      child_grade: "初二",
      subject,
      region,
      address_detail: "测试地址",
      schedule_description: "周末下午",
      budget_min: 10000,
      budget_max: 18000,
      description: utf8Description,
    }),
  })

  assert.equal(created.status, 201)
  assert.equal(created.body.demand.status, "DRAFT")
  assert.equal(created.body.demand.parent_id, login.body.user.id)
  assert.equal(created.body.demand.title, utf8Title)
  assert.equal(created.body.demand.description, utf8Description)
  const demandId = created.body.demand.id

  const ownerDetail = await request(`/api/v1/demands/${demandId}`, { token })
  assert.equal(ownerDetail.status, 200)
  assert.equal(ownerDetail.body.demand.address_detail, "测试地址")
  assert.equal(ownerDetail.body.demand.title, utf8Title)
  assert.equal(ownerDetail.body.demand.description, utf8Description)

  const mine = await request("/api/v1/parents/me/demands", { token })
  assert.equal(mine.status, 200)
  assert.ok(mine.body.demands.some((demand) => demand.id === demandId))

  const published = await request(`/api/v1/demands/${demandId}/publish`, {
    method: "POST",
    token,
  })
  assert.equal(published.status, 200)
  assert.equal(published.body.demand.status, "RECRUITING")

  const studentDetail = await request(`/api/v1/demands/${demandId}`, {
    token: studentLogin.body.token,
  })
  assert.equal(studentDetail.status, 200)
  assert.equal(studentDetail.body.demand.id, demandId)
  assert.equal("address_detail" in studentDetail.body.demand, false)

  const anonymousDetail = await request(`/api/v1/demands/${demandId}`)
  assert.equal(anonymousDetail.status, 401)

  const publicList = await request(
    `/api/v1/demands?subject=${encodeURIComponent(subject)}&region=${encodeURIComponent(region)}`,
    { token },
  )
  assert.equal(publicList.status, 200)
  assert.ok(publicList.body.demands.some((demand) => demand.id === demandId))
  assert.equal("address_detail" in publicList.body.demands[0], false)

  const closed = await request(`/api/v1/demands/${demandId}/close`, {
    method: "POST",
    token,
  })
  assert.equal(closed.status, 200)
  assert.equal(closed.body.demand.status, "CLOSED")

  const afterClose = await request(
    `/api/v1/demands?subject=${encodeURIComponent(subject)}&region=${encodeURIComponent(region)}`,
    { token },
  )
  assert.equal(afterClose.status, 200)
  assert.equal(afterClose.body.demands.some((demand) => demand.id === demandId), false)
})
