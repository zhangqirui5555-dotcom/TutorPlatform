const applicationService = require("../services/applicationService")

async function submitApplication(req, res) {
  const application = await applicationService.submitApplication(
    req.user.id,
    req.params.demandId,
    req.body || {},
  )
  res.status(201).json({ application })
}

async function getMyApplications(req, res) {
  const applications = await applicationService.getMyApplications(req.user.id)
  res.json({ applications })
}

async function getDemandApplications(req, res) {
  const applications = await applicationService.getDemandApplications(
    req.user.id,
    req.params.demandId,
  )
  res.json({ applications })
}

async function acceptApplication(req, res) {
  const result = await applicationService.acceptApplication(req.user.id, req.params.id)
  res.json(result)
}

async function rejectApplication(req, res) {
  const application = await applicationService.rejectApplication(req.user.id, req.params.id)
  res.json({ application })
}

module.exports = {
  acceptApplication,
  getDemandApplications,
  getMyApplications,
  rejectApplication,
  submitApplication,
}
