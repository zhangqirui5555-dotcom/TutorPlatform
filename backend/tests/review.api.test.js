require("dotenv").config()

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")

let baseUrl
let fixture
let server

const FORBIDDEN_REVIEW_KEYS = new Set([
  "email",
  "phone",
  "wechat",
  "address",
  "addressdetail",
  "password",
  "passwordhash",
])

function assertNoSensitiveReviewKeys(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveReviewKeys)
    return
  }

  if (!value || typeof value !== "object") return

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.replaceAll("_", "").toLowerCase()
    assert.equal(
      FORBIDDEN_REVIEW_KEYS.has(normalizedKey),
      false,
      `Review response exposed forbidden key: ${key}`,
    )
    assertNoSensitiveReviewKeys(nestedValue)
  }
}

before(async () => {
  const [parent, student] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "parent@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "student@test.com" } }),
  ])
  const marker = Date.now()

  fixture = await prisma.$transaction(async (transaction) => {
    const demand = await transaction.demand.create({
      data: {
        parentId: parent.id,
        title: `Review test ${marker}`,
        childGrade: "初二",
        subject: "MATH",
        region: "REVIEW_TEST_REGION",
        scheduleDescription: "周末下午",
        budgetMin: 10000,
        budgetMax: 18000,
        status: "MATCHED",
        publishedAt: new Date(),
        matchedAt: new Date(),
      },
    })

    const application = await transaction.application.create({
      data: {
        studentId: student.id,
        demandId: demand.id,
        coverMessage: "阶段 11 评价测试投递",
        status: "ACCEPTED",
        decidedAt: new Date(),
      },
    })

    const scheduledStartAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const scheduledEndAt = new Date(Date.now() - 60 * 60 * 1000)
    const completed = await transaction.trialLesson.create({
      data: {
        applicationId: application.id,
        demandId: demand.id,
        parentId: parent.id,
        studentId: student.id,
        proposedBy: student.id,
        scheduledStartAt,
        scheduledEndAt,
        method: "ONLINE",
        status: "COMPLETED",
        confirmedAt: scheduledStartAt,
        completedAt: scheduledEndAt,
      },
    })

    const confirmed = await transaction.trialLesson.create({
      data: {
        applicationId: application.id,
        demandId: demand.id,
        parentId: parent.id,
        studentId: student.id,
        proposedBy: student.id,
        scheduledStartAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledEndAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        method: "ONLINE",
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    })

    return {
      completed,
      confirmed,
      parent,
      student,
    }
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

test("completed trial lesson participants can review each other", async () => {
  const [student, parent, admin] = await Promise.all([
    login("student@test.com"),
    login("parent@test.com"),
    login("admin@test.com"),
  ])
  const completedId = fixture.completed.id

  const invalidRating = await request(`/api/v1/trial-lessons/${completedId}/reviews`, {
    method: "POST",
    token: student.token,
    body: JSON.stringify({
      rating: 6,
      content: "非法评分",
    }),
  })
  assert.equal(invalidRating.status, 400)
  assert.equal(invalidRating.body.error.code, "INVALID_RATING")

  const unfinished = await request(
    `/api/v1/trial-lessons/${fixture.confirmed.id}/reviews`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify({
        rating: 5,
        content: "尚未完成",
      }),
    },
  )
  assert.equal(unfinished.status, 409)
  assert.equal(unfinished.body.error.code, "TRIAL_LESSON_NOT_COMPLETED")

  const outsider = await request(`/api/v1/trial-lessons/${completedId}/reviews`, {
    method: "POST",
    token: admin.token,
    body: JSON.stringify({
      rating: 5,
      content: "非参与者",
    }),
  })
  assert.equal(outsider.status, 403)

  const studentReview = await request(
    `/api/v1/trial-lessons/${completedId}/reviews`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify({
        rating: 5,
        content: "家长沟通顺畅",
      }),
    },
  )
  assert.equal(studentReview.status, 201)
  assert.equal(studentReview.body.review.reviewer_id, student.user.id)
  assert.equal(studentReview.body.review.reviewee_id, parent.user.id)

  const duplicate = await request(`/api/v1/trial-lessons/${completedId}/reviews`, {
    method: "POST",
    token: student.token,
    body: JSON.stringify({
      rating: 4,
      content: "重复评价",
    }),
  })
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.body.error.code, "REVIEW_ALREADY_EXISTS")

  const parentReview = await request(
    `/api/v1/trial-lessons/${completedId}/reviews`,
    {
      method: "POST",
      token: parent.token,
      body: JSON.stringify({
        rating: 5,
        content: "学生讲解清晰",
      }),
    },
  )
  assert.equal(parentReview.status, 201)
  assert.equal(parentReview.body.review.reviewer_id, parent.user.id)
  assert.equal(parentReview.body.review.reviewee_id, student.user.id)

  const parentReceived = await request(`/api/v1/users/${parent.user.id}/reviews`, {
    token: student.token,
  })
  assert.equal(parentReceived.status, 200)
  assertNoSensitiveReviewKeys(parentReceived.body)
  assert.ok(
    parentReceived.body.reviews.some(
      (review) => review.id === studentReview.body.review.id &&
        review.content === "家长沟通顺畅",
    ),
  )

  const studentReceived = await request(`/api/v1/users/${student.user.id}/reviews`, {
    token: parent.token,
  })
  assert.equal(studentReceived.status, 200)
  assertNoSensitiveReviewKeys(studentReceived.body)
  assert.ok(
    studentReceived.body.reviews.some(
      (review) => review.id === parentReview.body.review.id &&
        review.content === "学生讲解清晰",
    ),
  )

  const mine = await request("/api/v1/reviews/me", {
    token: student.token,
  })
  assert.equal(mine.status, 200)
  assert.ok(mine.body.sent.some((review) => review.id === studentReview.body.review.id))
  assert.ok(
    mine.body.received.some((review) => review.id === parentReview.body.review.id),
  )

  const databaseReviews = await prisma.review.findMany({
    where: { trialLessonId: completedId },
  })
  assert.equal(databaseReviews.length, 2)
  assert.deepEqual(
    new Set(databaseReviews.map((review) => review.reviewerId)),
    new Set([student.user.id, parent.user.id]),
  )
})
