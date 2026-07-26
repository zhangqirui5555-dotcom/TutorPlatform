const toMessageResponse = require("./messageResponse")

function toUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
  }
}

function toConversationResponse(conversation, currentUserId) {
  const otherParticipant =
    conversation.parentId === currentUserId ? conversation.student : conversation.parent

  return {
    id: conversation.id,
    application_id: conversation.applicationId,
    demand_id: conversation.demandId,
    parent_id: conversation.parentId,
    student_id: conversation.studentId,
    status: conversation.status,
    last_message_at: conversation.lastMessageAt,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    demand: conversation.demand
      ? {
          id: conversation.demand.id,
          title: conversation.demand.title,
          subject: conversation.demand.subject,
          region: conversation.demand.region,
          status: conversation.demand.status,
        }
      : undefined,
    parent: conversation.parent ? toUserSummary(conversation.parent) : undefined,
    student: conversation.student ? toUserSummary(conversation.student) : undefined,
    other_participant: otherParticipant ? toUserSummary(otherParticipant) : undefined,
    last_message: conversation.messages?.[0]
      ? toMessageResponse(conversation.messages[0])
      : null,
  }
}

module.exports = toConversationResponse
