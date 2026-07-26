function toUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
  }
}

function toTrialLessonResponse(trialLesson) {
  const response = {
    id: trialLesson.id,
    application_id: trialLesson.applicationId,
    demand_id: trialLesson.demandId,
    parent_id: trialLesson.parentId,
    student_id: trialLesson.studentId,
    proposed_by: trialLesson.proposedBy,
    scheduled_start_at: trialLesson.scheduledStartAt,
    scheduled_end_at: trialLesson.scheduledEndAt,
    method: trialLesson.method,
    location_or_link: trialLesson.locationOrLink,
    status: trialLesson.status,
    cancellation_reason: trialLesson.cancellationReason,
    confirmed_at: trialLesson.confirmedAt,
    completed_at: trialLesson.completedAt,
    cancelled_at: trialLesson.cancelledAt,
    created_at: trialLesson.createdAt,
    updated_at: trialLesson.updatedAt,
  }

  if (trialLesson.demand) {
    response.demand = {
      id: trialLesson.demand.id,
      title: trialLesson.demand.title,
      subject: trialLesson.demand.subject,
      region: trialLesson.demand.region,
      status: trialLesson.demand.status,
    }
  }

  if (trialLesson.parent) {
    response.parent = toUserSummary(trialLesson.parent)
  }

  if (trialLesson.student) {
    response.student = toUserSummary(trialLesson.student)
  }

  return response
}

module.exports = toTrialLessonResponse
