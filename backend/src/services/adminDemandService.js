const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const runtimeConfig = require("../utils/runtimeConfig")
const {
  toAdminDemandOperationLogResponse,
  toAdminDemandResponse,
} = require("../utils/adminDemandResponse")

const MAX_PAGE_SIZE = 100
const MAX_PUBLIC_SUMMARY_LENGTH = 300
const MAX_REASON_LENGTH = 500
const MIN_SORT_WEIGHT = 0
const MAX_SORT_WEIGHT = 10000
const OPERATING_FIELDS = [
  "status",
  "visibilityStatus",
  "publicSummary",
  "isFeatured",
  "sortWeight",
  "featuredAt",
  "featuredUntil",
  "expiresAt",
  "listedAt",
  "unlistedAt",
]

const ADMIN_DEMAND_INCLUDE = {
  parent: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      status: true,
    },
  },
  _count: {
    select: {
      applications: true,
    },
  },
}

function requirePositiveId(value, label = "demand") {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_DEMAND_ID", `${label} ID must be a positive integer`)
  }
  return id
}

function parsePositiveInteger(value, fallback, maximum, fieldName) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      `${fieldName} must be an integer between 1 and ${maximum}`,
    )
  }
  return parsed
}

function optionalText(value, fieldName) {
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_ADMIN_DEMAND_FILTER", `${fieldName} must be a string`)
  }
  return value.trim() || undefined
}

function optionalBoolean(value, fieldName) {
  if (value === undefined) return undefined
  if (value === true || value === "true") return true
  if (value === false || value === "false") return false
  throw new AppError(400, "INVALID_ADMIN_DEMAND_FILTER", `${fieldName} must be true or false`)
}

function requireBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new AppError(400, "INVALID_ADMIN_DEMAND_OPERATION", `${fieldName} must be a boolean`)
  }
  return value
}

function requireReason(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "OPERATION_REASON_REQUIRED", "reason is required")
  }
  const reason = value.trim()
  if (reason.length > MAX_REASON_LENGTH) {
    throw new AppError(
      400,
      "OPERATION_REASON_TOO_LONG",
      `reason must not exceed ${MAX_REASON_LENGTH} characters`,
    )
  }
  return reason
}

function requirePublicSummary(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "PUBLIC_SUMMARY_REQUIRED", "public_summary is required when listing a demand")
  }
  const summary = value.trim()
  if (summary.length > MAX_PUBLIC_SUMMARY_LENGTH) {
    throw new AppError(
      400,
      "PUBLIC_SUMMARY_TOO_LONG",
      `public_summary must not exceed ${MAX_PUBLIC_SUMMARY_LENGTH} characters`,
    )
  }
  return summary
}

function requireFutureDate(value, fieldName, now, { required = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new AppError(400, "INVALID_OPERATION_DATE", `${fieldName} is required`)
    }
    return undefined
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_OPERATION_DATE", `${fieldName} must be a valid date`)
  }
  if (date <= now) {
    throw new AppError(400, "INVALID_OPERATION_DATE", `${fieldName} must be in the future`)
  }
  return date
}

function requireDate(value, fieldName) {
  const date = new Date(value)
  if (value === undefined || value === null || value === "" || Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_OPERATION_DATE", `${fieldName} must be a valid date`)
  }
  return date
}

function requireSortWeight(value) {
  if (
    !Number.isInteger(value) ||
    value < MIN_SORT_WEIGHT ||
    value > MAX_SORT_WEIGHT
  ) {
    throw new AppError(
      400,
      "INVALID_SORT_WEIGHT",
      `sort_weight must be an integer between ${MIN_SORT_WEIGHT} and ${MAX_SORT_WEIGHT}`,
    )
  }
  return value
}

function operatingSnapshot(demand) {
  return Object.fromEntries(
    OPERATING_FIELDS.map((field) => {
      const value = demand[field]
      return [field, value instanceof Date ? value.toISOString() : value ?? null]
    }),
  )
}

function operationContext(context = {}) {
  return {
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
  }
}

async function findDemand(transaction, demandId) {
  const demand = await transaction.demand.findUnique({
    where: { id: demandId },
    include: ADMIN_DEMAND_INCLUDE,
  })
  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand was not found")
  }
  return demand
}

function ensureListable(demand) {
  if (demand.status !== "RECRUITING") {
    throw new AppError(409, "DEMAND_NOT_LISTABLE", "Only RECRUITING demands can be listed")
  }
  if (demand.parent.role !== "PARENT" || demand.parent.status !== "ACTIVE") {
    throw new AppError(409, "DEMAND_PARENT_NOT_ACTIVE", "Demand parent must be an active PARENT")
  }
}

function ensureFeatureable(demand, now) {
  if (demand.status !== "RECRUITING") {
    throw new AppError(409, "DEMAND_NOT_FEATUREABLE", "Only RECRUITING demands can be featured")
  }
  if (demand.visibilityStatus !== "VISIBLE") {
    throw new AppError(409, "DEMAND_NOT_VISIBLE", "Only VISIBLE demands can be featured")
  }
  if (demand.expiresAt && demand.expiresAt <= now) {
    throw new AppError(409, "DEMAND_EXPIRED", "Expired demands cannot be featured")
  }
  if (demand.parent.status !== "ACTIVE") {
    throw new AppError(409, "DEMAND_PARENT_NOT_ACTIVE", "Demand parent must be active")
  }
}

async function writeOperationLog(transaction, {
  action,
  adminId,
  after,
  before,
  context,
  demandId,
  reason,
}) {
  const requestContext = operationContext(context)
  return transaction.adminOperationLog.create({
    data: {
      adminId,
      action,
      targetType: "DEMAND",
      targetId: demandId,
      beforeData: operatingSnapshot(before),
      afterData: operatingSnapshot(after),
      reason,
      ...requestContext,
    },
  })
}

async function getDemands(query = {}) {
  const page = parsePositiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER, "page")
  const pageSize = parsePositiveInteger(query.page_size, 20, MAX_PAGE_SIZE, "page_size")
  const search = optionalText(query.search, "search")
  const status = optionalText(query.status, "status")?.toUpperCase()
  const visibilityStatus = optionalText(query.visibility_status, "visibility_status")?.toUpperCase()
  const subject = optionalText(query.subject, "subject")
  const region = optionalText(query.region, "region")
  const isFeatured = optionalBoolean(query.is_featured, "is_featured")
  const expired = optionalBoolean(query.expired, "expired")
  const now = new Date()
  const and = []

  if (search) {
    const exactDemandId = /^\d+$/.test(search) ? Number(search) : null
    and.push({
      OR: [
        ...(Number.isSafeInteger(exactDemandId) && exactDemandId > 0
          ? [{ id: exactDemandId }]
          : []),
        { title: { contains: search, mode: "insensitive" } },
        { parent: { is: { displayName: { contains: search, mode: "insensitive" } } } },
        { parent: { is: { email: { contains: search, mode: "insensitive" } } } },
      ],
    })
  }

  if (expired === false) {
    and.push({
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    })
  }

  const where = {
    ...(status ? { status } : {}),
    ...(visibilityStatus ? { visibilityStatus } : {}),
    ...(subject ? { subject } : {}),
    ...(region ? { region } : {}),
    ...(isFeatured !== undefined ? { isFeatured } : {}),
    ...(expired === true ? { expiresAt: { lte: now } } : {}),
    ...(and.length ? { AND: and } : {}),
  }

  const [total, demands] = await Promise.all([
    prisma.demand.count({ where }),
    prisma.demand.findMany({
      where,
      include: ADMIN_DEMAND_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    demands: demands.map(toAdminDemandResponse),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  }
}

async function updateVisibility(demandIdInput, input, adminId, context) {
  const demandId = requirePositiveId(demandIdInput)
  const reason = requireReason(input.reason)
  const visibilityStatus = optionalText(input.visibility_status, "visibility_status")?.toUpperCase()
  if (!new Set(["VISIBLE", "HIDDEN"]).has(visibilityStatus)) {
    throw new AppError(400, "INVALID_VISIBILITY_STATUS", "visibility_status must be VISIBLE or HIDDEN")
  }

  return prisma.$transaction(async (transaction) => {
    const before = await findDemand(transaction, demandId)
    const now = new Date()
    let data
    let action

    if (visibilityStatus === "VISIBLE") {
      ensureListable(before)
      const publicSummary = requirePublicSummary(input.public_summary)
      const expiresAt = input.expires_at
        ? requireFutureDate(input.expires_at, "expires_at", now)
        : new Date(now.getTime() + runtimeConfig.defaultDemandExpireDays * 86400000)
      data = {
        visibilityStatus: "VISIBLE",
        publicSummary,
        expiresAt,
        listedAt: now,
        unlistedAt: null,
      }
      action = "DEMAND_LIST"
    } else {
      data = {
        visibilityStatus: "HIDDEN",
        isFeatured: false,
        sortWeight: 0,
        featuredAt: null,
        featuredUntil: null,
        unlistedAt: now,
      }
      action = "DEMAND_UNLIST"
    }

    const after = await transaction.demand.update({
      where: { id: demandId },
      data,
      include: ADMIN_DEMAND_INCLUDE,
    })
    await writeOperationLog(transaction, {
      action,
      adminId,
      after,
      before,
      context,
      demandId,
      reason,
    })
    return toAdminDemandResponse(after)
  })
}

async function updateFeature(demandIdInput, input, adminId, context) {
  const demandId = requirePositiveId(demandIdInput)
  const reason = requireReason(input.reason)
  const isFeatured = requireBoolean(input.is_featured, "is_featured")

  return prisma.$transaction(async (transaction) => {
    const before = await findDemand(transaction, demandId)
    const now = new Date()
    let data
    let action

    if (isFeatured) {
      ensureFeatureable(before, now)
      const sortWeight = requireSortWeight(input.sort_weight)
      const featuredAt = input.featured_at
        ? requireDate(input.featured_at, "featured_at")
        : now
      const featuredUntil = requireFutureDate(
        input.featured_until,
        "featured_until",
        now,
      )
      if (featuredUntil <= featuredAt) {
        throw new AppError(
          400,
          "INVALID_FEATURE_WINDOW",
          "featured_until must be later than featured_at",
        )
      }
      if (before.expiresAt && featuredUntil > before.expiresAt) {
        throw new AppError(
          400,
          "FEATURE_EXCEEDS_DEMAND_EXPIRY",
          "featured_until must not be later than demand expires_at",
        )
      }
      data = {
        isFeatured: true,
        sortWeight,
        featuredAt,
        featuredUntil,
      }
      action = "DEMAND_FEATURE"
    } else {
      data = {
        isFeatured: false,
        sortWeight: 0,
        featuredAt: null,
        featuredUntil: null,
      }
      action = "DEMAND_UNFEATURE"
    }

    const after = await transaction.demand.update({
      where: { id: demandId },
      data,
      include: ADMIN_DEMAND_INCLUDE,
    })
    await writeOperationLog(transaction, {
      action,
      adminId,
      after,
      before,
      context,
      demandId,
      reason,
    })
    return toAdminDemandResponse(after)
  })
}

async function updateExpiry(demandIdInput, input, adminId, context) {
  const demandId = requirePositiveId(demandIdInput)
  const reason = requireReason(input.reason)
  const now = new Date()
  const expiresAt = requireFutureDate(input.expires_at, "expires_at", now)

  return prisma.$transaction(async (transaction) => {
    const before = await findDemand(transaction, demandId)
    const cancelFeature = before.isFeatured && (
      before.featuredUntil === null || before.featuredUntil > expiresAt
    )
    const data = {
      expiresAt,
      ...(cancelFeature
        ? {
            isFeatured: false,
            sortWeight: 0,
            featuredAt: null,
            featuredUntil: null,
          }
        : {}),
    }
    const after = await transaction.demand.update({
      where: { id: demandId },
      data,
      include: ADMIN_DEMAND_INCLUDE,
    })
    await writeOperationLog(transaction, {
      action: "DEMAND_EXPIRY_UPDATE",
      adminId,
      after,
      before,
      context,
      demandId,
      reason,
    })
    return toAdminDemandResponse(after)
  })
}

async function getOperationLogs(demandIdInput, query = {}) {
  const demandId = requirePositiveId(demandIdInput)
  const page = parsePositiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER, "page")
  const pageSize = parsePositiveInteger(query.page_size, 20, MAX_PAGE_SIZE, "page_size")
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    select: { id: true },
  })
  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand was not found")
  }
  const where = { targetType: "DEMAND", targetId: demandId }
  const [total, logs] = await Promise.all([
    prisma.adminOperationLog.count({ where }),
    prisma.adminOperationLog.findMany({
      where,
      include: { admin: { select: { id: true, displayName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return {
    logs: logs.map(toAdminDemandOperationLogResponse),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  }
}

module.exports = {
  getDemands,
  getOperationLogs,
  updateExpiry,
  updateFeature,
  updateVisibility,
}
