function toUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
  }
}

function toReviewResponse(review) {
  const response = {
    id: review.id,
    trial_lesson_id: review.trialLessonId,
    reviewer_id: review.reviewerId,
    reviewee_id: review.revieweeId,
    rating: review.rating,
    content: review.content,
    created_at: review.createdAt,
    updated_at: review.updatedAt,
  }

  if (review.reviewer) {
    response.reviewer = toUserSummary(review.reviewer)
  }

  if (review.reviewee) {
    response.reviewee = toUserSummary(review.reviewee)
  }

  if (review.trialLesson) {
    response.trial_lesson = {
      id: review.trialLesson.id,
      status: review.trialLesson.status,
      scheduled_start_at: review.trialLesson.scheduledStartAt,
      scheduled_end_at: review.trialLesson.scheduledEndAt,
      demand: review.trialLesson.demand
        ? {
            id: review.trialLesson.demand.id,
            title: review.trialLesson.demand.title,
            subject: review.trialLesson.demand.subject,
          }
        : undefined,
    }
  }

  return response
}

module.exports = toReviewResponse
