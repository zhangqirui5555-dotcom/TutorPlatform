const assert = require("node:assert/strict")
const { test } = require("node:test")

const toReviewResponse = require("../src/utils/reviewResponse")

const FORBIDDEN_KEYS = new Set([
  "email",
  "phone",
  "wechat",
  "address",
  "addressdetail",
  "password",
  "passwordhash",
])

function assertNoSensitiveKeys(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveKeys)
    return
  }

  if (!value || typeof value !== "object") return

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.replaceAll("_", "").toLowerCase()
    assert.equal(
      FORBIDDEN_KEYS.has(normalizedKey),
      false,
      `Review DTO exposed forbidden key: ${key}`,
    )
    assertNoSensitiveKeys(nestedValue)
  }
}

test("review DTO keeps display content and removes participant contact fields", () => {
  const response = toReviewResponse({
    id: 1,
    trialLessonId: 2,
    reviewerId: 3,
    revieweeId: 4,
    rating: 5,
    content: "讲解清晰，沟通顺畅",
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    reviewer: {
      id: 3,
      email: "reviewer@example.com",
      phone: "13000000000",
      displayName: "评价人",
      role: "PARENT",
    },
    reviewee: {
      id: 4,
      email: "reviewee@example.com",
      passwordHash: "not-for-response",
      displayName: "被评价人",
      role: "STUDENT",
    },
  })

  assert.equal(response.content, "讲解清晰，沟通顺畅")
  assert.equal(response.reviewer.display_name, "评价人")
  assert.equal(response.reviewee.display_name, "被评价人")
  assertNoSensitiveKeys(response)
})
