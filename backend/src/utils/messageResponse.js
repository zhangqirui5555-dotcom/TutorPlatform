function toMessageResponse(message) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    content: message.content,
    message_type: message.messageType,
    sent_at: message.sentAt,
    read_at: message.readAt,
    created_at: message.createdAt,
    updated_at: message.updatedAt,
  }
}

module.exports = toMessageResponse
