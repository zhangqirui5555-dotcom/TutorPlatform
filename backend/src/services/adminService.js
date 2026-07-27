const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")

const MANAGEABLE_USER_STATUSES = new Set(["ACTIVE", "SUSPENDED"])

function toAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
    status: user.status,
    last_login_at: user.lastLoginAt,
    created_at: user.createdAt,
  }
}

function toGovernanceDemand(demand) {
  return {
    id: demand.id,
    title: demand.title,
    subject: demand.subject,
    region: demand.region,
    status: demand.status,
    published_at: demand.publishedAt,
    created_at: demand.createdAt,
    parent: {
      id: demand.parent.id,
      display_name: demand.parent.displayName,
      email: demand.parent.email,
    },
    application_count: demand._count.applications,
  }
}

async function getUsers({ role, status, search }) {
  const normalizedRole = typeof role === "string" ? role.trim().toUpperCase() : ""
  const normalizedStatus =
    typeof status === "string" ? status.trim().toUpperCase() : ""
  const normalizedSearch = typeof search === "string" ? search.trim() : ""

  const users = await prisma.user.findMany({
    where: {
      ...(normalizedRole ? { role: normalizedRole } : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { displayName: { contains: normalizedSearch, mode: "insensitive" } },
              { email: { contains: normalizedSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return users.map(toAdminUser)
}

async function updateUserStatus(userId, status, adminId) {
  const normalizedStatus =
    typeof status === "string" ? status.trim().toUpperCase() : ""

  if (!MANAGEABLE_USER_STATUSES.has(normalizedStatus)) {
    throw new AppError(400, "INVALID_USER_STATUS", "status must be ACTIVE or SUSPENDED")
  }

  if (userId === adminId) {
    throw new AppError(400, "CANNOT_UPDATE_SELF", "Administrators cannot change their own status")
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found")
  }

  if (user.role === "ADMIN") {
    throw new AppError(403, "ADMIN_STATUS_PROTECTED", "Administrator status cannot be changed here")
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: normalizedStatus },
  })
  return toAdminUser(updated)
}

async function getGovernanceOverview() {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    parents,
    students,
    pendingCertifications,
    recruitingDemands,
    matchedDemands,
    completedDemands,
    applications,
    activeConversations,
    demands,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: "PARENT" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.certification.count({ where: { status: "PENDING" } }),
    prisma.demand.count({ where: { status: "RECRUITING" } }),
    prisma.demand.count({ where: { status: "MATCHED" } }),
    prisma.demand.count({ where: { status: "COMPLETED" } }),
    prisma.application.count(),
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.demand.findMany({
      include: {
        parent: { select: { id: true, displayName: true, email: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  return {
    metrics: {
      total_users: totalUsers,
      active_users: activeUsers,
      suspended_users: suspendedUsers,
      parents,
      students,
      pending_certifications: pendingCertifications,
      recruiting_demands: recruitingDemands,
      matched_demands: matchedDemands,
      completed_demands: completedDemands,
      applications,
      active_conversations: activeConversations,
    },
    demands: demands.map(toGovernanceDemand),
  }
}

async function closeDemand(demandId) {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: {
      parent: { select: { id: true, displayName: true, email: true } },
      _count: { select: { applications: true } },
    },
  })

  if (!demand) {
    throw new AppError(404, "DEMAND_NOT_FOUND", "Demand was not found")
  }

  if (!["DRAFT", "RECRUITING"].includes(demand.status)) {
    throw new AppError(
      409,
      "DEMAND_CANNOT_BE_CLOSED",
      "Only draft or recruiting demands can be closed",
    )
  }

  const updated = await prisma.demand.update({
    where: { id: demandId },
    data: { status: "CLOSED", closedAt: new Date() },
    include: {
      parent: { select: { id: true, displayName: true, email: true } },
      _count: { select: { applications: true } },
    },
  })

  return toGovernanceDemand(updated)
}

module.exports = {
  closeDemand,
  getGovernanceOverview,
  getUsers,
  updateUserStatus,
}

