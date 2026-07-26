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

async function login(email, password = "Test123456!") {
  const response = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

  assert.equal(response.status, 200)
  return response.body
}

async function createRecruitingDemand(parentToken, marker) {
  const created = await request("/api/v1/demands", {
    method: "POST",
    token: parentToken,
    body: JSON.stringify({
      title: `Application workflow ${marker}`,
      child_grade: "初二",
      subject: "MATH",
      region: "MATCHING_TEST_REGION",
      schedule_description: "周末下午",
      budget_min: 10000,
      budget_max: 18000,
      description: "阶段 8 集成测试需求",
    }),
  })
  assert.equal(created.status, 201)

  const published = await request(`/api/v1/demands/${created.body.demand.id}/publish`, {
    method: "POST",
    token: parentToken,
  })
  assert.equal(published.status, 200)
  assert.equal(published.body.demand.status, "RECRUITING")

  return published.body.demand
}

async function ensureStudentIsApproved(studentToken, adminToken, studentEmail, marker) {
  const current = await request("/api/v1/certifications/me", {
    token: studentToken,
  })
  assert.equal(current.status, 200)

  if (current.body.current_status === "APPROVED") {
    return
  }

  let pendingId

  if (current.body.current_status === "PENDING") {
    pendingId = current.body.history.find((item) => item.status === "PENDING").id
  } else {
    const submitted = await request("/api/v1/certifications", {
      method: "POST",
      token: studentToken,
      body: JSON.stringify({
        material_path: `uploads/certifications/tests/${marker}-matching.jpg`,
        material_type: "STUDENT_CARD",
      }),
    })
    assert.equal(submitted.status, 201)
    pendingId = submitted.body.certification.id
  }

  const pending = await request("/api/v1/admin/certifications", {
    token: adminToken,
  })
  assert.equal(pending.status, 200)
  assert.ok(
    pending.body.certifications.some(
      (item) => item.id === pendingId && item.student.email === studentEmail,
    ),
  )

  const approved = await request(`/api/v1/admin/certifications/${pendingId}/approve`, {
    method: "POST",
    token: adminToken,
  })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.certification.status, "APPROVED")
}

test("student application and parent matching workflow", async () => {
  const marker = Date.now()
  const [parent, student, admin] = await Promise.all([
    login("parent@test.com"),
    login("student@test.com"),
    login("admin@test.com"),
  ])

  const demand = await createRecruitingDemand(parent.token, marker)

  const unverifiedEmail = `unverified.${marker}@test.com`
  const unverifiedPassword = "Unverified123!"
  const registered = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: unverifiedEmail,
      password: unverifiedPassword,
      display_name: "未认证测试学生",
      role: "STUDENT",
    }),
  })
  assert.equal(registered.status, 201)

  const unverifiedApplication = await request(
    `/api/v1/demands/${demand.id}/applications`,
    {
      method: "POST",
      token: registered.body.token,
      body: JSON.stringify({
        cover_message: "未认证学生不应投递成功",
      }),
    },
  )
  assert.equal(unverifiedApplication.status, 403)
  assert.equal(unverifiedApplication.body.error.code, "STUDENT_NOT_CERTIFIED")

  const newStudentCertification = await request("/api/v1/certifications", {
    method: "POST",
    token: registered.body.token,
    body: JSON.stringify({
      material_path: `uploads/certifications/tests/${marker}-new-student.jpg`,
      material_type: "STUDENT_CARD",
    }),
  })
  assert.equal(newStudentCertification.status, 201)

  const newStudentApproved = await request(
    `/api/v1/admin/certifications/${newStudentCertification.body.certification.id}/approve`,
    {
      method: "POST",
      token: admin.token,
    },
  )
  assert.equal(newStudentApproved.status, 200)

  const competingSubmission = await request(
    `/api/v1/demands/${demand.id}/applications`,
    {
      method: "POST",
      token: registered.body.token,
      body: JSON.stringify({
        cover_message: "认证后成功提交的竞争投递",
      }),
    },
  )
  assert.equal(competingSubmission.status, 201)
  const competingApplicationId = competingSubmission.body.application.id

  await ensureStudentIsApproved(
    student.token,
    admin.token,
    "student@test.com",
    marker,
  )

  const submitted = await request(`/api/v1/demands/${demand.id}/applications`, {
    method: "POST",
    token: student.token,
    body: JSON.stringify({
      cover_message: "我擅长初中数学，希望获得试课机会。",
    }),
  })
  assert.equal(submitted.status, 201)
  assert.equal(submitted.body.application.status, "PENDING")
  const applicationId = submitted.body.application.id

  const duplicate = await request(`/api/v1/demands/${demand.id}/applications`, {
    method: "POST",
    token: student.token,
    body: JSON.stringify({
      cover_message: "重复投递",
    }),
  })
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.body.error.code, "APPLICATION_ALREADY_EXISTS")

  const mineBeforeDecision = await request("/api/v1/applications/me", {
    token: student.token,
  })
  assert.equal(mineBeforeDecision.status, 200)
  assert.ok(mineBeforeDecision.body.applications.some((item) => item.id === applicationId))

  const parentView = await request(`/api/v1/demands/${demand.id}/applications`, {
    token: parent.token,
  })
  assert.equal(parentView.status, 200)
  assert.equal(
    parentView.body.applications.find((item) => item.id === applicationId).status,
    "VIEWED",
  )

  const accepted = await request(`/api/v1/applications/${applicationId}/accept`, {
    method: "POST",
    token: parent.token,
  })
  assert.equal(accepted.status, 200)
  assert.equal(accepted.body.application.status, "ACCEPTED")
  assert.equal(accepted.body.application.demand.status, "MATCHED")
  assert.equal(accepted.body.conversation.status, "ACTIVE")

  const [databaseApplication, databaseDemand, conversation] = await Promise.all([
    prisma.application.findUnique({ where: { id: applicationId } }),
    prisma.demand.findUnique({ where: { id: demand.id } }),
    prisma.conversation.findUnique({ where: { applicationId } }),
  ])

  assert.equal(databaseApplication.status, "ACCEPTED")
  assert.equal(databaseDemand.status, "MATCHED")
  assert.equal(conversation.applicationId, applicationId)
  assert.equal(conversation.demandId, demand.id)
  assert.equal(conversation.parentId, parent.user.id)
  assert.equal(conversation.studentId, student.user.id)

  const competingApplication = await prisma.application.findUnique({
    where: { id: competingApplicationId },
  })
  assert.equal(competingApplication.status, "REJECTED")
  assert.ok(competingApplication.decidedAt)

  const rejectDemand = await createRecruitingDemand(parent.token, `${marker}-reject`)
  const rejectSubmission = await request(
    `/api/v1/demands/${rejectDemand.id}/applications`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify({
        cover_message: "用于拒绝流程的测试投递",
      }),
    },
  )
  assert.equal(rejectSubmission.status, 201)

  const rejected = await request(
    `/api/v1/applications/${rejectSubmission.body.application.id}/reject`,
    {
      method: "POST",
      token: parent.token,
    },
  )
  assert.equal(rejected.status, 200)
  assert.equal(rejected.body.application.status, "REJECTED")
})
