const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toReviewResponse = require("../utils/reviewResponse")

const REVIEW_INCLUDE = {
  reviewer: {
    select: {
      id: true,
      displayName: true,
      role: true,
    },
  },
  reviewee: {
    select: {
      id: true,
      displayName: true,
      role: true,
    },
  },
  trialLesson: {
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      demand: {
        select: {
          id: true,
          title: true,
          subject: true,
        },
      },
    },
  },
}

function requirePositiveId(value, resourceName) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      400,
      `INVALID_${resourceName.toUpperCase()}_ID`,
      `${resourceName} ID must be a positive integer`,
    )
  }

  return id
}

function validateRating(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(400, "INVALID_RATING", "rating must be an integer from 1 to 5")
  }

  return value
}

function validateContent(value) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_REVIEW_CONTENT", "content must be a string")
  }

  const content = value.trim()

  if (!content) {
    return null
  }

  if (content.length > 1000) {
    throw new AppError(
      400,
      "REVIEW_CONTENT_TOO_LONG",
      "content cannot exceed 1000 characters",
    )
  }

  return content
}

async function submitReview(reviewerId, trialLessonIdInput, input) {
  const trialLessonId = requirePositiveId(trialLessonIdInput, "trial_lesson")
  const rating = validateRating(input.rating)
  const content = validateContent(input.content)
  const trialLesson = await prisma.trialLesson.findUnique({
    where: { id: trialLessonId },
  })

  if (!trialLesson) {
    throw new AppError(404, "TRIAL_LESSON_NOT_FOUND", "Trial lesson not found")
  }

  if (trialLesson.status !== "COMPLETED") {
    throw new AppError(
      409,
      "TRIAL_LESSON_NOT_COMPLETED",
      "Reviews require a COMPLETED trial lesson",
    )
  }

  if (reviewerId !== trialLesson.parentId && reviewerId !== trialLesson.studentId) {
    throw new AppError(403, "FORBIDDEN", "You are not a participant in this trial lesson")
  }

  const revieweeId =
    reviewerId === trialLesson.parentId ? trialLesson.studentId : trialLesson.parentId

  if (reviewerId === revieweeId) {
    throw new AppError(409, "INVALID_REVIEW_PARTICIPANTS", "A user cannot review themselves")
  }

  try {
    const review = await prisma.review.create({
      data: {
        trialLessonId,
        reviewerId,
        revieweeId,
        rating,
        content,
      },
      include: REVIEW_INCLUDE,
    })

    return toReviewResponse(review)
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "REVIEW_ALREADY_EXISTS",
        "You have already reviewed this trial lesson",
      )
    }

    throw error
  }
}

async function getReceivedReviews(userIdInput) {
  const userId = requirePositiveId(userIdInput, "user")
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found")
  }

  const reviews = await prisma.review.findMany({
    where: { revieweeId: userId },
    include: REVIEW_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  return reviews.map(toReviewResponse)
}

async function getMyReviews(userId) {
  const [sent, received] = await Promise.all([
    prisma.review.findMany({
      where: { reviewerId: userId },
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.review.findMany({
      where: { revieweeId: userId },
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ])

  return {
    sent: sent.map(toReviewResponse),
    received: received.map(toReviewResponse),
  }
}

module.exports = {
  getMyReviews,
  getReceivedReviews,
  submitReview,
}
