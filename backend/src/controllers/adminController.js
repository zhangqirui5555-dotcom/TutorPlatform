const adminService = require("../services/adminService")
const adminDemandService = require("../services/adminDemandService")

function requestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  }
}

async function getDemands(req, res) {
  const result = await adminDemandService.getDemands(req.query || {})
  res.json(result)
}

async function updateDemandVisibility(req, res) {
  const demand = await adminDemandService.updateVisibility(
    req.params.id,
    req.body || {},
    req.user.id,
    requestContext(req),
  )
  res.json({ demand })
}

async function updateDemandFeature(req, res) {
  const demand = await adminDemandService.updateFeature(
    req.params.id,
    req.body || {},
    req.user.id,
    requestContext(req),
  )
  res.json({ demand })
}

async function updateDemandExpiry(req, res) {
  const demand = await adminDemandService.updateExpiry(
    req.params.id,
    req.body || {},
    req.user.id,
    requestContext(req),
  )
  res.json({ demand })
}

async function getDemandOperationLogs(req, res) {
  const result = await adminDemandService.getOperationLogs(
    req.params.id,
    req.query || {},
  )
  res.json(result)
}

async function getUsers(req, res) {
  const users = await adminService.getUsers(req.query || {})
  res.json({ users })
}

async function updateUserStatus(req, res) {
  const user = await adminService.updateUserStatus(
    Number(req.params.id),
    req.body?.status,
    req.user.id,
  )
  res.json({ user })
}

async function getGovernanceOverview(req, res) {
  const overview = await adminService.getGovernanceOverview()
  res.json(overview)
}

async function closeDemand(req, res) {
  const demand = await adminService.closeDemand(Number(req.params.id))
  res.json({ demand })
}

async function reopenDemand(req, res) {
  const demand = await adminService.reopenDemand(Number(req.params.id))
  res.json({ demand })
}

module.exports = {
  closeDemand,
  getDemandOperationLogs,
  getDemands,
  getGovernanceOverview,
  getUsers,
  reopenDemand,
  updateDemandExpiry,
  updateDemandFeature,
  updateDemandVisibility,
  updateUserStatus,
}

