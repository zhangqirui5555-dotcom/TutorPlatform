const demandService = require("../services/demandService")

async function createDemand(req, res) {
  const demand = await demandService.createDemand(req.user.id, req.body || {})
  res.status(201).json({ demand })
}

async function getMyDemands(req, res) {
  const demands = await demandService.getMyDemands(req.user.id)
  res.json({ demands })
}

async function getPublicDemands(req, res) {
  const demands = await demandService.getPublicDemands({
    subject: req.query.subject,
    region: req.query.region,
  })
  res.json({ demands })
}

async function getDemandDetail(req, res) {
  const demand = await demandService.getDemandDetail(req.params.id, req.user.id)
  res.json({ demand })
}

async function publishDemand(req, res) {
  const demand = await demandService.publishDemand(Number(req.params.id), req.user.id)
  res.json({ demand })
}

async function closeDemand(req, res) {
  const demand = await demandService.closeDemand(Number(req.params.id), req.user.id)
  res.json({ demand })
}

module.exports = {
  closeDemand,
  createDemand,
  getDemandDetail,
  getMyDemands,
  getPublicDemands,
  publishDemand,
}
