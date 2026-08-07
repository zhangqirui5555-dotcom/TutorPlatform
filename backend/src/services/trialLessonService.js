const prisma = require("../prisma/client")
const notificationService = require("./notificationService")
const AppError = require("../utils/AppError")
const toTrialLessonResponse = require("../utils/trialLessonResponse")

const TRIAL_LESSON_NOTIFICATION_COPY = {
  TRIAL_LESSON_PROPOSED: {
    title: "Trial lesson proposed",
    body: "A new trial lesson was proposed.",
  },
  TRIAL_LESSON_CONFIRMED: {
    title: "Trial lesson confirmed",
    body: "The trial lesson was confirmed.",
  },
  TRIAL_LESSON_CANCELLED: {
    title: "Trial lesson cancelled",
    body: "The trial lesson was cancelled.",
  },
  TRIAL_LESSON_COMPLETED: {
    title: "Trial lesson completed",
    body: "The trial lesson was completed.",
  },
}

const PARTICIPANT_INCLUDE = {
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

function requireDateTime(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_TRIAL_LESSON_TIME", `${fieldName} is required`)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      400,
      "INVALID_TRIAL_LESSON_TIME",
      `${fieldName} must be a valid ISO 8601 date-time`,
    )
  }

  return date
}

function validateMethod(value) {
  const method = typeof value === "string" ? value.trim().toUpperCase() : ""

  if (!["ONLINE", "OFFLINE"].includes(method)) {
    throw new AppError(
      400,
      "INVALID_TRIAL_LESSON_METHOD",
      "method must be ONLINE or OFFLINE",
    )
  }

  return method
}

function optionalText(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_TRIAL_LESSON", `${fieldName} must be a string`)
  }

  return value.trim() || null
}

function assertParticipant(resource, userId) {
  if (resource.parentId !== userId && resource.studentId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You are not a participant in this trial lesson")
  }
}

function otherParticipantId(trialLesson, userId) {
  return trialLesson.parentId === userId
    ? trialLesson.studentId
    : trialLesson.parentId
}

function participantActionPath(trialLesson, recipientId) {
  return recipientId === trialLesson.parentId
    ? "/parent/trial-lessons"
    : "/student/trial-lessons"
}

function trialLessonPayload(trialLesson, additionalPayload = {}) {
  return {
    trial_lesson_id: trialLesson.id,
    application_id: trialLesson.applicationId,
    demand_id: trialLesson.demandId,
    ...(trialLesson.orderId === null || trialLesson.orderId === undefined
      ? {}
      : { order_id: trialLesson.orderId }),
    ...additionalPayload,
  }
}

function trialLessonNotification({ trialLesson, type, recipientId, actorId, payload }) {
  const copy = TRIAL_LESSON_NOTIFICATION_COPY[type]

  return {
    recipientId,
    actorId,
    eventKey: `${type}:${trialLesson.id}:${recipientId}`,
    type,
    title: copy.title,
    body: copy.body,
    resourceType: "TRIAL_LESSON",
    resourceId: trialLesson.id,
    actionPath: participantActionPath(trialLesson, recipientId),
    payload,
  }
}

async function createTrialLesson(userId, applicationIdInput, input) {
  const applicationId = requirePositiveId(applicationIdInput, "application")
  const scheduledStartAt = requireDateTime(
    input.scheduled_start_at,
    "scheduled_start_at",
  )
  const scheduledEndAt = requireDateTime(input.scheduled_end_at, "scheduled_end_at")

  if (scheduledEndAt <= scheduledStartAt) {
    throw new AppError(
      400,
      "INVALID_TRIAL_LESSON_TIME_RANGE",
      "scheduled_end_at must be later than scheduled_start_at",
    )
  }

  const method = validateMethod(input.method)
  const locationOrLink = optionalText(input.location_or_link, "location_or_link")
  return prisma.$transaction(async (transaction) => {
    const application = await transaction.application.findUnique({
      where: { id: applicationId },
      include: {
        demand: {
          select: {
            id: true,
            parentId: true,
          },
        },
        order: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found")
    }

    if (application.status !== "ACCEPTED") {
      throw new AppError(
        409,
        "APPLICATION_NOT_ACCEPTED",
        "Trial lessons require an ACCEPTED application",
      )
    }

    const parentId = application.demand.parentId
    const studentId = application.studentId

    if (userId !== parentId && userId !== studentId) {
      throw new AppError(403, "FORBIDDEN", "You are not a participant in this application")
    }

    const trialLesson = await transaction.trialLesson.create({
      data: {
        applicationId: application.id,
        orderId: application.order?.id || null,
        demandId: application.demand.id,
        parentId,
        studentId,
        proposedBy: userId,
        scheduledStartAt,
        scheduledEndAt,
        method,
        locationOrLink,
        status: "PENDING_CONFIRMATION",
      },
      include: PARTICIPANT_INCLUDE,
    })
    const recipientId = otherParticipantId(trialLesson, userId)

    await notificationService.createNotification(transaction, trialLessonNotification({
      trialLesson,
      type: "TRIAL_LESSON_PROPOSED",
      recipientId,
      actorId: userId,
      payload: trialLessonPayload(trialLesson, {
        scheduled_at: trialLesson.scheduledStartAt.toISOString(),
      }),
    }))

    return toTrialLessonResponse(trialLesson)
  })
}

async function getMyTrialLessons(userId) {
  const trialLessons = await prisma.trialLesson.findMany({
    where: {
      OR: [{ parentId: userId }, { studentId: userId }],
    },
    include: PARTICIPANT_INCLUDE,
    orderBy: [{ scheduledStartAt: "asc" }, { id: "asc" }],
  })

  return trialLessons.map(toTrialLessonResponse)
}

async function getParticipantTrialLesson(client, trialLessonId, userId) {
  const trialLesson = await client.trialLesson.findUnique({
    where: { id: trialLessonId },
    include: PARTICIPANT_INCLUDE,
  })

  if (!trialLesson) {
    throw new AppError(404, "TRIAL_LESSON_NOT_FOUND", "Trial lesson not found")
  }

  assertParticipant(trialLesson, userId)
  return trialLesson
}

async function getTrialLesson(userId, trialLessonIdInput) {
  const trialLessonId = requirePositiveId(trialLessonIdInput, "trial_lesson")
  const trialLesson = await getParticipantTrialLesson(prisma, trialLessonId, userId)
  return toTrialLessonResponse(trialLesson)
}

async function updateStatus({
  userId,
  trialLessonIdInput,
  allowedStatuses,
  nextStatus,
  notificationType,
  extraData,
  notificationPayload,
  beforeUpdate,
}) {
  const trialLessonId = requirePositiveId(trialLessonIdInput, "trial_lesson")

  return prisma.$transaction(async (transaction) => {
    const trialLesson = await getParticipantTrialLesson(
      transaction,
      trialLessonId,
      userId,
    )

    if (!allowedStatuses.includes(trialLesson.status)) {
      throw new AppError(
        409,
        "INVALID_TRIAL_LESSON_STATUS",
        `Trial lesson cannot transition from ${trialLesson.status} to ${nextStatus}`,
      )
    }

    if (beforeUpdate) {
      beforeUpdate(trialLesson)
    }

    const result = await transaction.trialLesson.updateMany({
      where: {
        id: trialLesson.id,
        status: { in: allowedStatuses },
      },
      data: {
        status: nextStatus,
        ...extraData,
      },
    })

    if (result.count !== 1) {
      throw new AppError(
        409,
        "TRIAL_LESSON_ALREADY_UPDATED",
        "Trial lesson was updated by another participant",
      )
    }

    const updated = await transaction.trialLesson.findUnique({
      where: { id: trialLesson.id },
      include: PARTICIPANT_INCLUDE,
    })
    const recipientId = otherParticipantId(trialLesson, userId)

    await notificationService.createNotification(transaction, trialLessonNotification({
      trialLesson: updated,
      type: notificationType,
      recipientId,
      actorId: userId,
      payload: trialLessonPayload(updated, notificationPayload
        ? notificationPayload(updated)
        : {}),
    }))

    return toTrialLessonResponse(updated)
  })
}

async function confirmTrialLesson(userId, trialLessonIdInput) {
  return updateStatus({
    userId,
    trialLessonIdInput,
    allowedStatuses: ["PENDING_CONFIRMATION"],
    nextStatus: "CONFIRMED",
    notificationType: "TRIAL_LESSON_CONFIRMED",
    extraData: {
      confirmedAt: new Date(),
    },
    beforeUpdate: (trialLesson) => {
      if (trialLesson.proposedBy === userId) {
        throw new AppError(
          403,
          "CONFIRMATION_REQUIRES_OTHER_PARTICIPANT",
          "The participant who created the proposal cannot confirm it",
        )
      }
    },
  })
}

async function cancelTrialLesson(userId, trialLessonIdInput, input) {
  return updateStatus({
    userId,
    trialLessonIdInput,
    allowedStatuses: ["PENDING_CONFIRMATION", "CONFIRMED"],
    nextStatus: "CANCELLED",
    notificationType: "TRIAL_LESSON_CANCELLED",
    extraData: {
      cancelledAt: new Date(),
      cancellationReason: optionalText(input.cancellation_reason, "cancellation_reason"),
    },
    notificationPayload: (trialLesson) => ({
      cancellation_reason: trialLesson.cancellationReason,
    }),
  })
}

async function completeTrialLesson(userId, trialLessonIdInput) {
  return updateStatus({
    userId,
    trialLessonIdInput,
    allowedStatuses: ["CONFIRMED"],
    nextStatus: "COMPLETED",
    notificationType: "TRIAL_LESSON_COMPLETED",
    extraData: {
      completedAt: new Date(),
    },
  })
}

module.exports = {
  cancelTrialLesson,
  completeTrialLesson,
  confirmTrialLesson,
  createTrialLesson,
  getMyTrialLessons,
  getTrialLesson,
}
