const prisma = require("../prisma/client")
const notificationService = require("./notificationService")
const AppError = require("../utils/AppError")
const toOrderResponse = require("../utils/orderResponse")

const ORDER_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
])
const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"]
const MAX_PAGE_SIZE = 50
const ORDER_NOTIFICATION_COPY = {
  ORDER_CONFIRMED: {
    title: "Order terms confirmed",
    body: "The parent confirmed the tutoring order terms.",
  },
  ORDER_IN_PROGRESS: {
    title: "Order in progress",
    body: "The student confirmed the tutoring order.",
  },
  ORDER_COMPLETED: {
    title: "Order completed",
    body: "The tutoring order was completed.",
  },
  ORDER_CANCELLED: {
    title: "Order cancelled",
    body: "The tutoring order was cancelled.",
  },
}

const ORDER_SUMMARY_INCLUDE = {
  parent: {
    select: { id: true, email: true, displayName: true, role: true },
  },
  student: {
    select: { id: true, email: true, displayName: true, role: true },
  },
  demand: {
    select: { id: true, title: true, subject: true, region: true, status: true },
  },
  application: {
    select: {
      id: true,
      status: true,
      conversation: { select: { id: true } },
    },
  },
}

const ORDER_DETAIL_INCLUDE = {
  ...ORDER_SUMMARY_INCLUDE,
  trialLessons: {
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      completedAt: true,
    },
    orderBy: [{ scheduledStartAt: "desc" }, { id: "desc" }],
  },
}

function requirePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `INVALID_${fieldName.toUpperCase()}`, `${fieldName} must be a positive integer`)
  }

  return parsed
}

function parsePagination(query = {}) {
  const page = query.page === undefined
    ? 1
    : requirePositiveInteger(query.page, "page")
  const pageSize = query.page_size === undefined
    ? 20
    : requirePositiveInteger(query.page_size, "page_size")

  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(
      400,
      "INVALID_PAGE_SIZE",
      `page_size must be an integer between 1 and ${MAX_PAGE_SIZE}`,
    )
  }

  return { page, pageSize }
}

function parseStatus(value) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const status = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (!ORDER_STATUSES.has(status)) {
    throw new AppError(400, "INVALID_ORDER_STATUS_FILTER", "status is not a valid order status")
  }

  return status
}

function accessWhere(user) {
  if (user.role === "ADMIN") {
    return {}
  }

  if (user.role === "PARENT") {
    return { parentId: user.id }
  }

  if (user.role === "STUDENT") {
    return { studentId: user.id }
  }

  throw new AppError(403, "ORDER_ACCESS_DENIED", "Your role cannot access orders")
}

function assertOrderAccess(order, user) {
  if (
    user.role !== "ADMIN" &&
    order.parentId !== user.id &&
    order.studentId !== user.id
  ) {
    throw new AppError(403, "ORDER_ACCESS_DENIED", "You cannot access this order")
  }
}

function assertActionRole(order, user, allowedParticipantRole) {
  if (user.role === "ADMIN") {
    return
  }

  assertOrderAccess(order, user)
  if (user.role !== allowedParticipantRole) {
    throw new AppError(
      403,
      "ORDER_ACTION_FORBIDDEN",
      `Only the order ${allowedParticipantRole.toLowerCase()} can perform this action`,
    )
  }
}

function assertStatus(order, allowedStatuses, nextStatus) {
  if (!allowedStatuses.includes(order.status)) {
    throw new AppError(
      409,
      "INVALID_ORDER_STATUS",
      `Order cannot transition from ${order.status} to ${nextStatus}`,
    )
  }
}

async function findOrder(client, orderId, include = ORDER_DETAIL_INCLUDE) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    include,
  })

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found")
  }

  return order
}

async function findAccessibleOrder(client, user, orderId, include = ORDER_DETAIL_INCLUDE) {
  const order = await findOrder(client, orderId, include)
  assertOrderAccess(order, user)
  return order
}

function requireAmount(value, fieldName, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(value) || value < minimum) {
    throw new AppError(
      400,
      "INVALID_ORDER_AMOUNT",
      `${fieldName} must be an integer${allowZero ? "" : " greater than zero"} in cents`,
    )
  }

  return value
}

function parseCurrency(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  const currency = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AppError(400, "INVALID_ORDER_CURRENCY", "currency must be a three-letter code")
  }

  return currency
}

function requireCancellationReason(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "CANCELLATION_REASON_REQUIRED", "cancellation_reason is required")
  }

  const reason = value.trim()
  if (reason.length > 500) {
    throw new AppError(400, "CANCELLATION_REASON_TOO_LONG", "cancellation_reason cannot exceed 500 characters")
  }

  return reason
}

function orderNotification({ order, type, recipientId, actorId, actionPath, payload }) {
  const copy = ORDER_NOTIFICATION_COPY[type]

  return {
    recipientId,
    actorId,
    eventKey: `${type}:${order.id}:${recipientId}`,
    type,
    title: copy.title,
    body: copy.body,
    resourceType: "ORDER",
    resourceId: order.id,
    actionPath,
    payload,
  }
}

async function getOrders(user, query = {}) {
  const { page, pageSize } = parsePagination(query)
  const status = parseStatus(query.status)
  const where = {
    ...accessWhere(user),
    ...(status ? { status } : {}),
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: ORDER_SUMMARY_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    orders: orders.map(toOrderResponse),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  }
}

async function getOrder(user, orderIdInput) {
  const orderId = requirePositiveInteger(orderIdInput, "order_id")
  const order = await findAccessibleOrder(prisma, user, orderId)
  return toOrderResponse(order)
}

async function updateTerms(user, orderIdInput, input = {}) {
  const orderId = requirePositiveInteger(orderIdInput, "order_id")

  return prisma.$transaction(async (transaction) => {
    const order = await findOrder(transaction, orderId, ORDER_SUMMARY_INCLUDE)
    assertActionRole(order, user, "PARENT")
    assertStatus(order, ["PENDING"], "CONFIRMED")

    const totalAmount = requireAmount(input.total_amount, "total_amount")
    const currency = parseCurrency(input.currency, order.currency)
    const hasPlatformFee = Object.prototype.hasOwnProperty.call(input, "platform_fee")

    if (user.role !== "ADMIN" && hasPlatformFee) {
      throw new AppError(403, "PLATFORM_FEE_ADMIN_ONLY", "Only an administrator can set platform_fee")
    }

    const platformFee = hasPlatformFee
      ? requireAmount(input.platform_fee, "platform_fee", { allowZero: true })
      : order.platformFee

    if (platformFee !== null && platformFee > totalAmount) {
      throw new AppError(400, "INVALID_PLATFORM_FEE", "platform_fee cannot exceed total_amount")
    }

    const result = await transaction.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        totalAmount,
        platformFee,
        currency,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    })

    if (result.count !== 1) {
      throw new AppError(409, "ORDER_ALREADY_UPDATED", "Order was updated by another request")
    }

    await notificationService.createNotification(transaction, orderNotification({
      order,
      type: "ORDER_CONFIRMED",
      recipientId: order.studentId,
      actorId: order.parentId,
      actionPath: "/student/orders",
      payload: {
        order_id: order.id,
        demand_id: order.demandId,
        total_amount: totalAmount,
        currency,
      },
    }))

    return toOrderResponse(await findOrder(transaction, order.id))
  })
}

async function confirmOrder(user, orderIdInput) {
  const orderId = requirePositiveInteger(orderIdInput, "order_id")

  return prisma.$transaction(async (transaction) => {
    const order = await findOrder(transaction, orderId, ORDER_SUMMARY_INCLUDE)
    assertActionRole(order, user, "STUDENT")
    assertStatus(order, ["CONFIRMED"], "IN_PROGRESS")

    if (order.totalAmount === null) {
      throw new AppError(409, "ORDER_TERMS_REQUIRED", "Order terms must be set before confirmation")
    }

    const result = await transaction.order.updateMany({
      where: { id: order.id, status: "CONFIRMED" },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    })

    if (result.count !== 1) {
      throw new AppError(409, "ORDER_ALREADY_UPDATED", "Order was updated by another request")
    }

    await notificationService.createNotification(transaction, orderNotification({
      order,
      type: "ORDER_IN_PROGRESS",
      recipientId: order.parentId,
      actorId: order.studentId,
      actionPath: "/parent/orders",
      payload: {
        order_id: order.id,
        demand_id: order.demandId,
      },
    }))

    return toOrderResponse(await findOrder(transaction, order.id))
  })
}

async function completeOrder(user, orderIdInput) {
  const orderId = requirePositiveInteger(orderIdInput, "order_id")

  return prisma.$transaction(async (transaction) => {
    const order = await findOrder(transaction, orderId, ORDER_SUMMARY_INCLUDE)
    assertActionRole(order, user, "PARENT")
    assertStatus(order, ["IN_PROGRESS"], "COMPLETED")

    const completionCutoff = new Date()
    const completedTrialLessons = await transaction.trialLesson.count({
      where: {
        orderId: order.id,
        status: "COMPLETED",
        scheduledEndAt: { lte: completionCutoff },
      },
    })
    if (completedTrialLessons === 0) {
      throw new AppError(
        409,
        "COMPLETED_TRIAL_LESSON_REQUIRED",
        "A completed trial lesson is required before completing the order",
      )
    }

    const completedAt = new Date()
    const orderResult = await transaction.order.updateMany({
      where: { id: order.id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt },
    })
    if (orderResult.count !== 1) {
      throw new AppError(409, "ORDER_ALREADY_UPDATED", "Order was updated by another request")
    }

    const demandResult = await transaction.demand.updateMany({
      where: { id: order.demandId, status: "MATCHED" },
      data: { status: "COMPLETED", completedAt },
    })
    if (demandResult.count !== 1) {
      throw new AppError(409, "DEMAND_NOT_MATCHED", "The order demand is not in MATCHED status")
    }

    const recipients = user.role === "ADMIN"
      ? [
          { recipientId: order.parentId, actionPath: "/parent/orders" },
          { recipientId: order.studentId, actionPath: "/student/orders" },
        ]
      : [{ recipientId: order.studentId, actionPath: "/student/orders" }]

    await notificationService.createNotifications(
      transaction,
      recipients.map(({ recipientId, actionPath }) => orderNotification({
        order,
        type: "ORDER_COMPLETED",
        recipientId,
        actorId: user.role === "ADMIN" ? user.id : order.parentId,
        actionPath,
        payload: {
          order_id: order.id,
          demand_id: order.demandId,
          total_amount: order.totalAmount,
          platform_fee: order.platformFee,
          currency: order.currency,
        },
      })),
    )

    return toOrderResponse(await findOrder(transaction, order.id))
  })
}

async function cancelOrder(user, orderIdInput, input = {}) {
  const orderId = requirePositiveInteger(orderIdInput, "order_id")
  const reason = requireCancellationReason(input.cancellation_reason)

  return prisma.$transaction(async (transaction) => {
    const order = await findOrder(transaction, orderId, ORDER_SUMMARY_INCLUDE)
    assertOrderAccess(order, user)
    assertStatus(order, CANCELLABLE_STATUSES, "CANCELLED")

    const result = await transaction.order.updateMany({
      where: { id: order.id, status: { in: CANCELLABLE_STATUSES } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    })

    if (result.count !== 1) {
      throw new AppError(409, "ORDER_ALREADY_UPDATED", "Order was updated by another request")
    }

    const recipients = user.role === "ADMIN"
      ? [
          { recipientId: order.parentId, actionPath: "/parent/orders" },
          { recipientId: order.studentId, actionPath: "/student/orders" },
        ]
      : user.role === "PARENT"
        ? [{ recipientId: order.studentId, actionPath: "/student/orders" }]
        : [{ recipientId: order.parentId, actionPath: "/parent/orders" }]

    await notificationService.createNotifications(
      transaction,
      recipients.map(({ recipientId, actionPath }) => orderNotification({
        order,
        type: "ORDER_CANCELLED",
        recipientId,
        actorId: user.id,
        actionPath,
        payload: {
          order_id: order.id,
          demand_id: order.demandId,
          cancellation_reason: reason,
        },
      })),
    )

    return toOrderResponse(await findOrder(transaction, order.id))
  })
}

module.exports = {
  cancelOrder,
  completeOrder,
  confirmOrder,
  getOrder,
  getOrders,
  updateTerms,
}
