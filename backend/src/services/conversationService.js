const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toConversationResponse = require("../utils/conversationResponse")
const toMessageResponse = require("../utils/messageResponse")

function requireConversationId(value) {
  const conversationId = Number(value)

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    throw new AppError(
      400,
      "INVALID_CONVERSATION_ID",
      "Conversation ID must be a positive integer",
    )
  }

  return conversationId
}

function assertParticipant(conversation, userId) {
  if (conversation.parentId !== userId && conversation.studentId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You are not a participant in this conversation")
  }
}

async function getConversation(conversationId, userId, client = prisma) {
  const conversation = await client.conversation.findUnique({
    where: { id: conversationId },
  })

  if (!conversation) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found")
  }

  assertParticipant(conversation, userId)
  return conversation
}

async function getMyConversations(userId) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ parentId: userId }, { studentId: userId }],
    },
    include: {
      demand: {
        select: {
          id: true,
          title: true,
          subject: true,
          region: true,
          status: true,
        },
      },
      parent: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      },
      student: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      },
      messages: {
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  })

  return conversations.map((conversation) =>
    toConversationResponse(conversation, userId),
  )
}

async function getMessages(userId, conversationIdInput) {
  const conversationId = requireConversationId(conversationIdInput)
  await getConversation(conversationId, userId)

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
  })

  return messages.map(toMessageResponse)
}

function validateContent(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_MESSAGE_CONTENT", "content is required")
  }

  const content = value.trim()

  if (content.length > 2000) {
    throw new AppError(
      400,
      "MESSAGE_CONTENT_TOO_LONG",
      "content cannot exceed 2000 characters",
    )
  }

  return content
}

async function sendMessage(userId, conversationIdInput, input) {
  const conversationId = requireConversationId(conversationIdInput)
  const content = validateContent(input.content)

  return prisma.$transaction(async (transaction) => {
    const conversation = await getConversation(conversationId, userId, transaction)

    if (conversation.status !== "ACTIVE") {
      throw new AppError(
        409,
        "CONVERSATION_NOT_ACTIVE",
        "Messages can only be sent in an ACTIVE conversation",
      )
    }

    const receiverId =
      conversation.parentId === userId ? conversation.studentId : conversation.parentId
    const sentAt = new Date()

    const message = await transaction.message.create({
      data: {
        conversationId,
        senderId: userId,
        receiverId,
        content,
        messageType: "TEXT",
        sentAt,
      },
    })

    await transaction.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: sentAt },
    })

    return toMessageResponse(message)
  })
}

async function markRead(userId, conversationIdInput) {
  const conversationId = requireConversationId(conversationIdInput)
  await getConversation(conversationId, userId)
  const readAt = new Date()
  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      receiverId: userId,
      readAt: null,
    },
    data: { readAt },
  })

  return {
    updated_count: result.count,
    read_at: readAt,
  }
}

module.exports = {
  getMessages,
  getMyConversations,
  markRead,
  sendMessage,
}
