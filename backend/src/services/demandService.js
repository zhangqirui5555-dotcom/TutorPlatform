const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toDemandResponse = require("../utils/demandResponse")

const REQUIRED_TEXT_FIELDS = [
  ["title", "title"],
  ["child_grade", "childGrade"],
  ["subject", "subject"],
  ["region", "region"],
  ["schedule_description", "scheduleDescription"],
]

function requireText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_DEMAND", `${fieldName} is required`)
  }

  return value.trim()
}

function optionalText(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_DEMAND", `${fieldName} must be a string`)
  }

  return value.trim() || null
}

function requireBudget(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(
      400,
      "INVALID_BUDGET",
      `${fieldName} must be a non-negative integer in cents`,
    )
  }

  return value
}

function validateCreateInput(input) {
  const data = {}

  for (const [requestField, modelField] of REQUIRED_TEXT_FIELDS) {
    data[modelField] = requireText(input[requestField], requestField)
  }

  data.addressDetail = optionalText(input.address_detail, "address_detail")
  data.description = optionalText(input.description, "description")
  data.budgetMin = requireBudget(input.budget_min, "budget_min")
  data.budgetMax = requireBudget(input.budget_max, "budget_max")

  if (data.budgetMin > data.budgetMax) {
    throw new AppError(
      400,
      "INVALID_BUDGET_RANGE",
      "budget_min cannot be greater than budget_max",
    )
  }

  return data
}

async function findOwnedDemand(demandId, parentId) {
  if (!Number.isInteger(demandId) || demandId <= 0) {
    throw new AppError(400, "INVALID_DEMAND_ID", "Demand ID must be a positive integer")
  }

  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
  })

  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand not found")
  }

  if (demand.parentId !== parentId) {
    throw new AppError(403, "FORBIDDEN", "You do not own this demand")
  }

  return demand
}

async function createDemand(parentId, input) {
  const data = validateCreateInput(input)
  const demand = await prisma.demand.create({
    data: {
      ...data,
      parentId,
      status: "DRAFT",
    },
  })

  return toDemandResponse(demand, { includePrivateFields: true })
}

async function getMyDemands(parentId) {
  const demands = await prisma.demand.findMany({
    where: { parentId },
    orderBy: { createdAt: "desc" },
  })

  return demands.map((demand) => toDemandResponse(demand, { includePrivateFields: true }))
}

async function getPublicDemands({ subject, region }) {
  const where = {
    status: "RECRUITING",
  }

  if (subject !== undefined) {
    where.subject = requireText(subject, "subject")
  }

  if (region !== undefined) {
    where.region = requireText(region, "region")
  }

  const demands = await prisma.demand.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
  })

  return demands.map((demand) => toDemandResponse(demand))
}

async function getDemandDetail(demandIdInput, userId) {
  const demandId = Number(demandIdInput)

  if (!Number.isInteger(demandId) || demandId <= 0) {
    throw new AppError(400, "INVALID_DEMAND_ID", "Demand ID must be a positive integer")
  }

  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
  })

  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand not found")
  }

  return toDemandResponse(demand, {
    includePrivateFields: demand.parentId === userId,
  })
}

async function publishDemand(demandId, parentId) {
  const demand = await findOwnedDemand(demandId, parentId)

  if (demand.status !== "DRAFT") {
    throw new AppError(
      409,
      "INVALID_DEMAND_STATUS",
      "Only DRAFT demands can be published",
    )
  }

  const publishedDemand = await prisma.demand.update({
    where: { id: demand.id },
    data: {
      status: "RECRUITING",
      publishedAt: new Date(),
      closedAt: null,
    },
  })

  return toDemandResponse(publishedDemand, { includePrivateFields: true })
}

async function closeDemand(demandId, parentId) {
  const demand = await findOwnedDemand(demandId, parentId)

  if (demand.status === "CLOSED") {
    return toDemandResponse(demand, { includePrivateFields: true })
  }

  if (!["DRAFT", "RECRUITING", "MATCHED"].includes(demand.status)) {
    throw new AppError(
      409,
      "INVALID_DEMAND_STATUS",
      "This demand cannot be closed from its current status",
    )
  }

  const closedDemand = await prisma.demand.update({
    where: { id: demand.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  })

  return toDemandResponse(closedDemand, { includePrivateFields: true })
}

module.exports = {
  closeDemand,
  createDemand,
  getDemandDetail,
  getMyDemands,
  getPublicDemands,
  publishDemand,
}
