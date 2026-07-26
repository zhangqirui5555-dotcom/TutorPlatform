require("dotenv").config()

const assert = require("node:assert/strict")
const { after, before, test } = require("node:test")

const app = require("../src/app")
const prisma = require("../src/prisma/client")

let baseUrl
let conversationFixture
let server

before(async () => {
  const [parent, student] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "parent@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "student@test.com" } }),
  ])
  const marker = Date.now()

  conversationFixture = await prisma.$transaction(async (transaction) => {
    const demand = await transaction.demand.create({
      data: {
        parentId: parent.id,
        title: `Conversation test ${marker}`,
        childGrade: "初二",
        subject: "MATH",
        region: "CHAT_TEST_REGION",
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
        coverMessage: "阶段 9 会话测试投递",
        status: "ACCEPTED",
        decidedAt: new Date(),
      },
    })

    return transaction.conversation.create({
      data: {
        applicationId: application.id,
        demandId: demand.id,
        parentId: parent.id,
        studentId: student.id,
        status: "ACTIVE",
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
  assert.ok(response.body.token)
  return response.body
}

test("conversation participants can exchange messages and outsiders are forbidden", async () => {
  const [student, parent, admin] = await Promise.all([
    login("student@test.com"),
    login("parent@test.com"),
    login("admin@test.com"),
  ])
  const conversationId = conversationFixture.id

  const studentConversations = await request("/api/v1/conversations", {
    token: student.token,
  })
  assert.equal(studentConversations.status, 200)
  assert.ok(
    studentConversations.body.conversations.some(
      (conversation) => conversation.id === conversationId,
    ),
  )

  const emptyMessage = await request(
    `/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      token: student.token,
      body: JSON.stringify({ content: "   " }),
    },
  )
  assert.equal(emptyMessage.status, 400)
  assert.equal(emptyMessage.body.error.code, "INVALID_MESSAGE_CONTENT")

  const firstContent = `学生消息 ${Date.now()}`
  const sent = await request(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    token: student.token,
    body: JSON.stringify({ content: firstContent }),
  })
  assert.equal(sent.status, 201)
  assert.equal(sent.body.message.content, firstContent)
  assert.equal(sent.body.message.sender_id, student.user.id)
  assert.equal(sent.body.message.receiver_id, parent.user.id)

  const markedByParent = await request(
    `/api/v1/conversations/${conversationId}/read`,
    {
      method: "POST",
      token: parent.token,
    },
  )
  assert.equal(markedByParent.status, 200)
  assert.equal(markedByParent.body.updated_count, 1)

  const secondContent = "家长已收到消息"
  const replied = await request(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    token: parent.token,
    body: JSON.stringify({ content: secondContent }),
  })
  assert.equal(replied.status, 201)
  assert.equal(replied.body.message.receiver_id, student.user.id)

  const markedByStudent = await request(
    `/api/v1/conversations/${conversationId}/read`,
    {
      method: "POST",
      token: student.token,
    },
  )
  assert.equal(markedByStudent.status, 200)
  assert.equal(markedByStudent.body.updated_count, 1)

  const messages = await request(`/api/v1/conversations/${conversationId}/messages`, {
    token: parent.token,
  })
  assert.equal(messages.status, 200)
  assert.deepEqual(
    messages.body.messages.map((message) => message.content),
    [firstContent, secondContent],
  )
  assert.ok(
    messages.body.messages[0].sent_at <= messages.body.messages[1].sent_at,
  )
  assert.ok(messages.body.messages.every((message) => message.read_at))

  const parentConversations = await request("/api/v1/conversations", {
    token: parent.token,
  })
  assert.equal(parentConversations.status, 200)
  const parentConversation = parentConversations.body.conversations.find(
    (conversation) => conversation.id === conversationId,
  )
  assert.equal(parentConversation.last_message.content, secondContent)
  assert.ok(parentConversation.last_message_at)

  const forbiddenRead = await request(
    `/api/v1/conversations/${conversationId}/messages`,
    {
      token: admin.token,
    },
  )
  assert.equal(forbiddenRead.status, 403)

  const forbiddenSend = await request(
    `/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ content: "非参与者消息" }),
    },
  )
  assert.equal(forbiddenSend.status, 403)

  const forbiddenMarkRead = await request(
    `/api/v1/conversations/${conversationId}/read`,
    {
      method: "POST",
      token: admin.token,
    },
  )
  assert.equal(forbiddenMarkRead.status, 403)

  const databaseConversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      },
    },
  })
  assert.ok(databaseConversation.lastMessageAt)
  assert.equal(databaseConversation.messages.length, 2)
})
