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
  assert.ok(response.body.token)
  return response.body.token
}

test("student profile and certification review workflow", async () => {
  const [studentToken, parentToken, adminToken] = await Promise.all([
    login("student@test.com"),
    login("parent@test.com"),
    login("admin@test.com"),
  ])

  const parentForbidden = await request("/api/v1/student-profile/me", {
    token: parentToken,
  })
  assert.equal(parentForbidden.status, 403)

  const profileInput = {
    school: "TutorPlatform 测试大学",
    major: "数学与应用数学",
    grade: "大三",
    subjects: ["MATH", "PHYSICS"],
    teaching_experience: "两年家教测试经验",
    bio: "阶段 7 集成测试资料",
    expected_price_min: 8000,
    expected_price_max: 15000,
    teaching_regions: ["DEMO_REGION", "DEMO_REGION_2"],
  }

  const savedProfile = await request("/api/v1/student-profile/me", {
    method: "PUT",
    token: studentToken,
    body: JSON.stringify(profileInput),
  })
  assert.equal(savedProfile.status, 200)
  assert.equal(savedProfile.body.profile.school, profileInput.school)
  assert.deepEqual(savedProfile.body.profile.subjects, profileInput.subjects)

  const profile = await request("/api/v1/student-profile/me", {
    token: studentToken,
  })
  assert.equal(profile.status, 200)
  assert.equal(profile.body.profile.user_id, savedProfile.body.profile.user_id)

  const marker = Date.now()
  const firstSubmission = await request("/api/v1/certifications", {
    method: "POST",
    token: studentToken,
    body: JSON.stringify({
      material_path: `uploads/certifications/tests/${marker}-approve.jpg`,
      material_type: "STUDENT_CARD",
    }),
  })
  assert.equal(firstSubmission.status, 201)
  assert.equal(firstSubmission.body.certification.status, "PENDING")

  const duplicatePending = await request("/api/v1/certifications", {
    method: "POST",
    token: studentToken,
    body: JSON.stringify({
      material_path: `uploads/certifications/tests/${marker}-duplicate.jpg`,
      material_type: "STUDENT_CARD",
    }),
  })
  assert.equal(duplicatePending.status, 409)
  assert.equal(duplicatePending.body.error.code, "PENDING_CERTIFICATION_EXISTS")

  const historyBeforeReview = await request("/api/v1/certifications/me", {
    token: studentToken,
  })
  assert.equal(historyBeforeReview.status, 200)
  assert.equal(historyBeforeReview.body.current_status, "PENDING")

  const pendingBeforeApprove = await request("/api/v1/admin/certifications", {
    token: adminToken,
  })
  assert.equal(pendingBeforeApprove.status, 200)
  assert.ok(
    pendingBeforeApprove.body.certifications.some(
      (item) => item.id === firstSubmission.body.certification.id,
    ),
  )

  const approved = await request(
    `/api/v1/admin/certifications/${firstSubmission.body.certification.id}/approve`,
    {
      method: "POST",
      token: adminToken,
    },
  )
  assert.equal(approved.status, 200)
  assert.equal(approved.body.certification.status, "APPROVED")

  const secondSubmission = await request("/api/v1/certifications", {
    method: "POST",
    token: studentToken,
    body: JSON.stringify({
      material_path: `uploads/certifications/tests/${marker}-reject.jpg`,
      material_type: "ENROLLMENT_CERTIFICATE",
    }),
  })
  assert.equal(secondSubmission.status, 201)

  const missingReason = await request(
    `/api/v1/admin/certifications/${secondSubmission.body.certification.id}/reject`,
    {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({}),
    },
  )
  assert.equal(missingReason.status, 400)
  assert.equal(missingReason.body.error.code, "REJECTION_REASON_REQUIRED")

  const rejected = await request(
    `/api/v1/admin/certifications/${secondSubmission.body.certification.id}/reject`,
    {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({
        rejection_reason: "测试材料不清晰",
      }),
    },
  )
  assert.equal(rejected.status, 200)
  assert.equal(rejected.body.certification.status, "REJECTED")
  assert.equal(rejected.body.certification.rejection_reason, "测试材料不清晰")

  const finalHistory = await request("/api/v1/certifications/me", {
    token: studentToken,
  })
  assert.equal(finalHistory.status, 200)
  assert.equal(finalHistory.body.current_status, "REJECTED")
  assert.ok(finalHistory.body.history.length >= 3)
})
