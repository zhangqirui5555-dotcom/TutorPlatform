const publicDemandService = require("../services/publicDemandService")

async function getPublicDemands(req, res) {
  const result = await publicDemandService.getPublicDemands(req.query || {})
  res.json(result)
}

async function getFeaturedDemands(req, res) {
  const result = await publicDemandService.getFeaturedDemands(req.query || {})
  res.json(result)
}

async function getPublicDemandDetail(req, res) {
  const demand = await publicDemandService.getPublicDemandDetail(req.params.id)
  res.json({ demand })
}

module.exports = {
  getFeaturedDemands,
  getPublicDemandDetail,
  getPublicDemands,
}
