require("dotenv").config()

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")

let applicationFixture
let baseUrl
let server

before(async () => {
  const [parent, student] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "parent@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "student@test.com" } }),
  ])
  const marker = Date.now()

  applicationFixture = await prisma.$transaction(async (transaction) => {
    const demand = await transaction.demand.create({
      data: {
        parentId: parent.id,
        title: `Trial lesson test ${marker}`,
        childGrade: "初二",
        subject: "MATH",
        region: "TRIAL_TEST_REGION",
        scheduleDescription: "周末下午",
        budgetMin: 10000,
        budgetMax: 18000,
        status: "MATCHED",
        publishedAt: new Date(),
        matchedAt: new Date(),
      },
    })

    return transaction.application.create({
      data: {
        studentId: student.id,
        demandId: demand.id,
        coverMessage: "阶段 10 试课测试投递",
        status: "ACCEPTED",
        decidedAt: new Date(),
      },
    })
  })

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
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
    "content-type": "application/json",
    ...options.headers,
  }

  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

async function login(email) {
  const response = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test123456!",
    }),
  })

  assert.equal(response.status, 200)
  return response.body
}

function schedule(hoursFromNow) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  return {
    scheduled_start_at: start.toISOString(),
    scheduled_end_at: end.toISOString(),
    method: "ONLINE",
    location_or_link: "https://example.test/trial-class",
  }
}

test("trial lesson creation, confirmation, completion, cancellation, and access control", async () => {
  const [student, parent, admin] = await Promise.all([
    login("student@test.com"),
    login("parent@test.com"),
    login("admin@test.com"),
  ])

  const invalidRange = await request(
    `/api/v1/applications/${applicationFixture.id}/trial-lessons`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify({
        scheduled_start_at: new Date(Date.now() + 7200000).toISOString(),
        scheduled_end_at: new Date(Date.now() + 3600000).toISOString(),
        method: "ONLINE",
      }),
    },
  )
  assert.equal(invalidRange.status, 400)
  assert.equal(invalidRange.body.error.code, "INVALID_TRIAL_LESSON_TIME_RANGE")

  const created = await request(
    `/api/v1/applications/${applicationFixture.id}/trial-lessons`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify(schedule(-2)),
    },
  )
  assert.equal(created.status, 201)
  assert.equal(created.body.trial_lesson.status, "PENDING_CONFIRMATION")
  assert.equal(created.body.trial_lesson.proposed_by, student.user.id)
  const completedTrialId = created.body.trial_lesson.id

  const selfConfirm = await request(
    `/api/v1/trial-lessons/${completedTrialId}/confirm`,
    {
      method: "POST",
      token: student.token,
    },
  )
  assert.equal(selfConfirm.status, 403)
  assert.equal(
    selfConfirm.body.error.code,
    "CONFIRMATION_REQUIRES_OTHER_PARTICIPANT",
  )

  const confirmed = await request(
    `/api/v1/trial-lessons/${completedTrialId}/confirm`,
    {
      method: "POST",
      token: parent.token,
    },
  )
  assert.equal(confirmed.status, 200)
  assert.equal(confirmed.body.trial_lesson.status, "CONFIRMED")
  assert.ok(confirmed.body.trial_lesson.confirmed_at)

  const detail = await request(`/api/v1/trial-lessons/${completedTrialId}`, {
    token: student.token,
  })
  assert.equal(detail.status, 200)
  assert.equal(detail.body.trial_lesson.id, completedTrialId)

  const completed = await request(
    `/api/v1/trial-lessons/${completedTrialId}/complete`,
    {
      method: "POST",
      token: student.token,
    },
  )
  assert.equal(completed.status, 200)
  assert.equal(completed.body.trial_lesson.status, "COMPLETED")
  assert.ok(completed.body.trial_lesson.completed_at)

  const toCancel = await request(
    `/api/v1/applications/${applicationFixture.id}/trial-lessons`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify(schedule(48)),
    },
  )
  assert.equal(toCancel.status, 201)
  const cancelledTrialId = toCancel.body.trial_lesson.id

  const futureConfirmed = await request(
    `/api/v1/trial-lessons/${cancelledTrialId}/confirm`,
    {
      method: "POST",
      token: parent.token,
    },
  )
  assert.equal(futureConfirmed.status, 200)
  assert.equal(futureConfirmed.body.trial_lesson.status, "CONFIRMED")

  const earlyCompletion = await request(
    `/api/v1/trial-lessons/${cancelledTrialId}/complete`,
    {
      method: "POST",
      token: student.token,
    },
  )
  assert.equal(earlyCompletion.status, 409)
  assert.equal(earlyCompletion.body.error.code, "TRIAL_LESSON_NOT_ENDED")

  const afterEarlyCompletion = await request(
    `/api/v1/trial-lessons/${cancelledTrialId}`,
    { token: student.token },
  )
  assert.equal(afterEarlyCompletion.status, 200)
  assert.equal(afterEarlyCompletion.body.trial_lesson.status, "CONFIRMED")

  const cancelled = await request(
    `/api/v1/trial-lessons/${cancelledTrialId}/cancel`,
    {
      method: "POST",
      token: parent.token,
      body: JSON.stringify({
        cancellation_reason: "测试取消预约",
      }),
    },
  )
  assert.equal(cancelled.status, 200)
  assert.equal(cancelled.body.trial_lesson.status, "CANCELLED")
  assert.equal(cancelled.body.trial_lesson.cancellation_reason, "测试取消预约")

  const parentList = await request("/api/v1/trial-lessons", {
    token: parent.token,
  })
  assert.equal(parentList.status, 200)
  assert.ok(
    parentList.body.trial_lessons.some(
      (trialLesson) => trialLesson.id === completedTrialId,
    ),
  )
  assert.ok(
    parentList.body.trial_lessons.some(
      (trialLesson) => trialLesson.id === cancelledTrialId,
    ),
  )

  const forbidden = await request(`/api/v1/trial-lessons/${completedTrialId}`, {
    token: admin.token,
  })
  assert.equal(forbidden.status, 403)

  const databaseTrials = await prisma.trialLesson.findMany({
    where: {
      id: { in: [completedTrialId, cancelledTrialId] },
    },
    orderBy: { id: "asc" },
  })
  assert.deepEqual(
    databaseTrials.map((trialLesson) => trialLesson.status).sort(),
    ["CANCELLED", "COMPLETED"],
  )
})
