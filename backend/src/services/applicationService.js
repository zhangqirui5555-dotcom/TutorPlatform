const prisma = require("../prisma/client")
const notificationService = require("./notificationService")
const AppError = require("../utils/AppError")
const availableDemandWhere = require("../utils/demandAvailability")
const toApplicationResponse = require("../utils/applicationResponse")
const toOrderResponse = require("../utils/orderResponse")

const UNRESOLVED_APPLICATION_STATUSES = ["PENDING", "VIEWED"]

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

function validateCoverMessage(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_COVER_MESSAGE", "cover_message is required")
  }

  return value.trim()
}

async function requireApprovedCertification(studentId) {
  const latestCertification = await prisma.certification.findFirst({
    where: { studentId },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    select: { status: true },
  })

  if (latestCertification?.status !== "APPROVED") {
    throw new AppError(
      403,
      "STUDENT_NOT_CERTIFIED",
      "An approved current certification is required to apply",
    )
  }
}

async function submitApplication(studentId, demandIdInput, input) {
  const demandId = requirePositiveId(demandIdInput, "demand")
  const coverMessage = validateCoverMessage(input.cover_message)

  await requireApprovedCertification(studentId)

  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    select: { id: true, parentId: true, status: true },
  })

  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand not found")
  }

  if (demand.status !== "RECRUITING") {
    throw new AppError(
      409,
      "DEMAND_NOT_RECRUITING",
      "Applications are only accepted for RECRUITING demands",
    )
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const availableDemand = await transaction.demand.findFirst({
        where: {
          id: demandId,
          ...availableDemandWhere(new Date()),
        },
        select: { id: true },
      })

      if (!availableDemand) {
        throw new AppError(
          409,
          "DEMAND_NOT_AVAILABLE",
          "This tutoring demand is not currently accepting applications",
        )
      }

      const application = await transaction.application.create({
        data: {
          studentId,
          demandId,
          coverMessage,
          status: "PENDING",
        },
        include: {
          demand: true,
        },
      })

      await notificationService.createNotification(transaction, {
        recipientId: demand.parentId,
        actorId: studentId,
        eventKey: `APPLICATION_RECEIVED:${application.id}`,
        type: "APPLICATION_RECEIVED",
        title: "New tutoring application",
        body: "A student submitted an application for your demand.",
        resourceType: "APPLICATION",
        resourceId: application.id,
        actionPath: `/parent/demands/${demandId}/applications`,
        payload: {
          application_id: application.id,
          demand_id: demandId,
        },
      })

      return toApplicationResponse(application)
    })
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "APPLICATION_ALREADY_EXISTS",
        "You have already applied to this demand",
      )
    }

    throw error
  }
}

async function getMyApplications(studentId) {
  const applications = await prisma.application.findMany({
    where: { studentId },
    include: { demand: true },
    orderBy: { createdAt: "desc" },
  })

  return applications.map(toApplicationResponse)
}

async function getDemandApplications(parentId, demandIdInput) {
  const demandId = requirePositiveId(demandIdInput, "demand")

  return prisma.$transaction(async (transaction) => {
    const demand = await transaction.demand.findUnique({
      where: { id: demandId },
      select: { parentId: true },
    })

    if (!demand) {
      throw new AppError(404, "DEMAND_NOT_FOUND", "Demand not found")
    }

    if (demand.parentId !== parentId) {
      throw new AppError(403, "FORBIDDEN", "You do not own this demand")
    }

    const viewedAt = new Date()
    await transaction.application.updateMany({
      where: {
        demandId,
        status: "PENDING",
      },
      data: {
        status: "VIEWED",
        viewedAt,
      },
    })

    const applications = await transaction.application.findMany({
      where: { demandId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            studentProfile: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return applications.map(toApplicationResponse)
  })
}

async function getApplicationForParent(transaction, applicationId, parentId) {
  const application = await transaction.application.findUnique({
    where: { id: applicationId },
    include: { demand: true },
  })

  if (!application) {
    throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found")
  }

  if (application.demand.parentId !== parentId) {
    throw new AppError(403, "FORBIDDEN", "You do not own this application demand")
  }

  return application
}

function assertMatchingResource(resource, application, parentId, resourceName) {
  if (
    resource.applicationId !== application.id ||
    resource.demandId !== application.demandId ||
    resource.parentId !== parentId ||
    resource.studentId !== application.studentId
  ) {
    throw new AppError(
      409,
      `${resourceName}_RELATION_CONFLICT`,
      `${resourceName} does not match the accepted application`,
    )
  }
}

function rejectedApplicationNotification(application, parentId) {
  return {
    recipientId: application.studentId,
    actorId: parentId,
    eventKey: `APPLICATION_REJECTED:${application.id}`,
    type: "APPLICATION_REJECTED",
    title: "Application not selected",
    body: "The parent did not select your tutoring application.",
    resourceType: "APPLICATION",
    resourceId: application.id,
    actionPath: "/student/applications",
    payload: {
      application_id: application.id,
      demand_id: application.demandId,
    },
  }
}

async function ensureConversation(transaction, application, parentId) {
  let conversation

  try {
    conversation = await transaction.conversation.upsert({
      where: { applicationId: application.id },
      update: {},
      create: {
        applicationId: application.id,
        demandId: application.demandId,
        parentId,
        studentId: application.studentId,
        status: "ACTIVE",
      },
    })
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "CONVERSATION_ALREADY_EXISTS",
        "This demand has already been matched",
      )
    }

    throw error
  }

  assertMatchingResource(conversation, application, parentId, "CONVERSATION")
  return conversation
}

async function ensureOrder(transaction, application, parentId) {
  let order

  try {
    order = await transaction.order.upsert({
      where: { applicationId: application.id },
      update: {},
      create: {
        parentId,
        studentId: application.studentId,
        demandId: application.demandId,
        applicationId: application.id,
        status: "PENDING",
      },
    })
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "ORDER_ALREADY_EXISTS",
        "This demand already has an order for another application",
      )
    }

    throw error
  }

  assertMatchingResource(order, application, parentId, "ORDER")
  return order
}

async function buildAcceptedResult(transaction, application, parentId) {
  const conversation = await ensureConversation(transaction, application, parentId)
  const order = await ensureOrder(transaction, application, parentId)
  const acceptedApplication = await transaction.application.findUnique({
    where: { id: application.id },
    include: { demand: true },
  })

  await notificationService.createNotification(transaction, {
    recipientId: application.studentId,
    actorId: parentId,
    eventKey: `APPLICATION_ACCEPTED:${application.id}`,
    type: "APPLICATION_ACCEPTED",
    title: "Application accepted",
    body: "The parent accepted your tutoring application.",
    resourceType: "APPLICATION",
    resourceId: application.id,
    actionPath: "/student/applications",
    payload: {
      application_id: application.id,
      demand_id: application.demandId,
      conversation_id: conversation.id,
      order_id: order.id,
    },
  })

  return {
    application: toApplicationResponse(acceptedApplication),
    conversation: {
      id: conversation.id,
      application_id: conversation.applicationId,
      demand_id: conversation.demandId,
      parent_id: conversation.parentId,
      student_id: conversation.studentId,
      status: conversation.status,
      created_at: conversation.createdAt,
    },
    order: toOrderResponse(order),
  }
}

async function acceptApplication(parentId, applicationIdInput) {
  const applicationId = requirePositiveId(applicationIdInput, "application")

  try {
    return await prisma.$transaction(async (transaction) => {
      const application = await getApplicationForParent(transaction, applicationId, parentId)

      if (application.status === "ACCEPTED") {
        return buildAcceptedResult(transaction, application, parentId)
      }

      if (!UNRESOLVED_APPLICATION_STATUSES.includes(application.status)) {
        throw new AppError(
          409,
          "INVALID_APPLICATION_STATUS",
          "Only PENDING or VIEWED applications can be accepted",
        )
      }

      if (application.demand.status !== "RECRUITING") {
        throw new AppError(
          409,
          "DEMAND_NOT_RECRUITING",
          "The demand is no longer recruiting",
        )
      }

      const decidedAt = new Date()
      const targetUpdate = await transaction.application.updateMany({
        where: {
          id: application.id,
          status: { in: UNRESOLVED_APPLICATION_STATUSES },
        },
        data: {
          status: "ACCEPTED",
          decidedAt,
        },
      })

      if (targetUpdate.count !== 1) {
        const currentApplication = await getApplicationForParent(
          transaction,
          application.id,
          parentId,
        )

        if (currentApplication.status === "ACCEPTED") {
          return buildAcceptedResult(transaction, currentApplication, parentId)
        }

        throw new AppError(
          409,
          "APPLICATION_ALREADY_DECIDED",
          "Application was already decided",
        )
      }

      const applicationsToReject = await transaction.application.findMany({
        where: {
          demandId: application.demandId,
          id: { not: application.id },
          status: { in: UNRESOLVED_APPLICATION_STATUSES },
        },
        select: {
          id: true,
          studentId: true,
          demandId: true,
        },
      })

      await transaction.application.updateMany({
        where: {
          demandId: application.demandId,
          id: { not: application.id },
          status: { in: UNRESOLVED_APPLICATION_STATUSES },
        },
        data: {
          status: "REJECTED",
          decidedAt,
        },
      })

      const demandUpdate = await transaction.demand.updateMany({
        where: {
          id: application.demandId,
          status: "RECRUITING",
        },
        data: {
          status: "MATCHED",
          matchedAt: decidedAt,
        },
      })

      if (demandUpdate.count !== 1) {
        throw new AppError(
          409,
          "DEMAND_ALREADY_MATCHED",
          "Demand was already matched or closed",
        )
      }

      const result = await buildAcceptedResult(transaction, application, parentId)

      await notificationService.createNotifications(
        transaction,
        applicationsToReject.map((rejectedApplication) =>
          rejectedApplicationNotification(rejectedApplication, parentId),
        ),
      )

      return result
    })
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        409,
        "MATCHING_RESOURCE_CONFLICT",
        "This demand already has a conflicting conversation or order",
      )
    }

    throw error
  }
}

async function rejectApplication(parentId, applicationIdInput) {
  const applicationId = requirePositiveId(applicationIdInput, "application")

  return prisma.$transaction(async (transaction) => {
    const application = await getApplicationForParent(transaction, applicationId, parentId)

    if (!UNRESOLVED_APPLICATION_STATUSES.includes(application.status)) {
      throw new AppError(
        409,
        "INVALID_APPLICATION_STATUS",
        "Only PENDING or VIEWED applications can be rejected",
      )
    }

    const result = await transaction.application.updateMany({
      where: {
        id: application.id,
        status: { in: UNRESOLVED_APPLICATION_STATUSES },
      },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
      },
    })

    if (result.count !== 1) {
      throw new AppError(
        409,
        "APPLICATION_ALREADY_DECIDED",
        "Application was already decided",
      )
    }

    const rejectedApplication = await transaction.application.findUnique({
      where: { id: application.id },
      include: { demand: true },
    })

    await notificationService.createNotification(
      transaction,
      rejectedApplicationNotification(
        rejectedApplication,
        application.demand.parentId,
      ),
    )

    return toApplicationResponse(rejectedApplication)
  })
}

module.exports = {
  acceptApplication,
  getDemandApplications,
  getMyApplications,
  rejectApplication,
  submitApplication,
}
