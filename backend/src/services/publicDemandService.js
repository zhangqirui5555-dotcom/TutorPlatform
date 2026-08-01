const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toPublicDemandResponse = require("../utils/publicDemandResponse")

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

const PUBLIC_DEMAND_SELECT = {
  id: true,
  title: true,
  childGrade: true,
  subject: true,
  region: true,
  scheduleDescription: true,
  budgetMin: true,
  budgetMax: true,
  priceUnit: true,
  currency: true,
  publicSummary: true,
  isFeatured: true,
  publishedAt: true,
  expiresAt: true,
}

function optionalFilter(value, fieldName) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_PUBLIC_DEMAND_FILTER", `${fieldName} must be a non-empty string`)
  }

  return value.trim()
}

function positiveInteger(value, fallback, maximum, fieldName) {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new AppError(
      400,
      "INVALID_PUBLIC_DEMAND_PAGINATION",
      `${fieldName} must be an integer between 1 and ${maximum}`,
    )
  }

  return parsed
}

function publicVisibilityWhere(now) {
  return {
    status: "RECRUITING",
    visibilityStatus: "VISIBLE",
    parent: {
      is: {
        role: "PARENT",
        status: "ACTIVE",
      },
    },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  }
}

function parseListOptions({ subject, region, page, page_size: pageSize }) {
  const parsedPage = positiveInteger(page, 1, Number.MAX_SAFE_INTEGER, "page")
  const parsedPageSize = positiveInteger(
    pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    "page_size",
  )

  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    region: optionalFilter(region, "region"),
    subject: optionalFilter(subject, "subject"),
  }
}

async function getPublicDemands(query = {}) {
  const { page, pageSize, region, subject } = parseListOptions(query)
  const where = {
    ...publicVisibilityWhere(new Date()),
    ...(subject ? { subject } : {}),
    ...(region ? { region } : {}),
  }

  const demands = await prisma.demand.findMany({
    where,
    select: PUBLIC_DEMAND_SELECT,
    orderBy: [{ listedAt: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return {
    demands: demands.map(toPublicDemandResponse),
    pagination: {
      page,
      page_size: pageSize,
      returned: demands.length,
    },
  }
}

async function getFeaturedDemands(query = {}) {
  const { page, pageSize, region, subject } = parseListOptions(query)
  const now = new Date()
  const where = {
    ...publicVisibilityWhere(now),
    isFeatured: true,
    AND: [
      {
        OR: [
          { featuredAt: null },
          { featuredAt: { lte: now } },
        ],
      },
      {
        OR: [
          { featuredUntil: null },
          { featuredUntil: { gt: now } },
        ],
      },
    ],
    ...(subject ? { subject } : {}),
    ...(region ? { region } : {}),
  }

  const demands = await prisma.demand.findMany({
    where,
    select: PUBLIC_DEMAND_SELECT,
    orderBy: [{ sortWeight: "desc" }, { featuredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return {
    demands: demands.map(toPublicDemandResponse),
    pagination: {
      page,
      page_size: pageSize,
      returned: demands.length,
    },
  }
}

async function getPublicDemandDetail(demandIdInput) {
  const demandId = Number(demandIdInput)
  if (!Number.isInteger(demandId) || demandId <= 0) {
    throw new AppError(400, "INVALID_DEMAND_ID", "Demand ID must be a positive integer")
  }

  const demand = await prisma.demand.findFirst({
    where: {
      id: demandId,
      ...publicVisibilityWhere(new Date()),
    },
    select: PUBLIC_DEMAND_SELECT,
  })

  if (!demand) {
    throw new AppError(404, "PUBLIC_DEMAND_NOT_FOUND", "Public demand was not found")
  }

  return toPublicDemandResponse(demand)
}

module.exports = {
  getFeaturedDemands,
  getPublicDemandDetail,
  getPublicDemands,
}
