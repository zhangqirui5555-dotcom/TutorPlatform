function toActorSummary(actor) {
  return {
    id: actor.id,
    email: actor.email,
    display_name: actor.displayName,
    role: actor.role,
  }
}

function toNotificationResponse(notification) {
  return {
    id: notification.id,
    recipient_id: notification.recipientId,
    actor_id: notification.actorId,
    event_key: notification.eventKey,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    resource_type: notification.resourceType,
    resource_id: notification.resourceId,
    action_path: notification.actionPath,
    payload: notification.payload,
    read_at: notification.readAt,
    created_at: notification.createdAt,
    updated_at: notification.updatedAt,
    actor: notification.actor ? toActorSummary(notification.actor) : null,
  }
}

module.exports = toNotificationResponse
