const adminService = require("../services/adminService")

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
  getGovernanceOverview,
  getUsers,
  reopenDemand,
  updateUserStatus,
}

