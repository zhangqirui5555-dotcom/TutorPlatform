function toUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
  }
}

function toOrderResponse(order) {
  const response = {
    id: order.id,
    parent_id: order.parentId,
    student_id: order.studentId,
    demand_id: order.demandId,
    application_id: order.applicationId,
    total_amount: order.totalAmount,
    platform_fee: order.platformFee,
    currency: order.currency,
    status: order.status,
    confirmed_at: order.confirmedAt,
    started_at: order.startedAt,
    completed_at: order.completedAt,
    cancelled_at: order.cancelledAt,
    cancellation_reason: order.cancellationReason,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  }

  if (order.parent) {
    response.parent = toUserSummary(order.parent)
  }

  if (order.student) {
    response.student = toUserSummary(order.student)
  }

  if (order.demand) {
    response.demand = {
      id: order.demand.id,
      title: order.demand.title,
      subject: order.demand.subject,
      region: order.demand.region,
      status: order.demand.status,
    }
  }

  if (order.application) {
    response.application = {
      id: order.application.id,
      status: order.application.status,
      conversation_id: order.application.conversation?.id || null,
    }
  }

  if (order.trialLessons) {
    response.trial_lessons = order.trialLessons.map((trialLesson) => ({
      id: trialLesson.id,
      status: trialLesson.status,
      scheduled_start_at: trialLesson.scheduledStartAt,
      scheduled_end_at: trialLesson.scheduledEndAt,
      completed_at: trialLesson.completedAt,
    }))
  }

  return response
}

module.exports = toOrderResponse
