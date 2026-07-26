const studentProfileService = require("../services/studentProfileService")

async function upsertMyProfile(req, res) {
  const profile = await studentProfileService.upsertMyProfile(req.user.id, req.body || {})
  res.json({ profile })
}

async function getMyProfile(req, res) {
  const profile = await studentProfileService.getMyProfile(req.user.id)
  res.json({ profile })
}

module.exports = {
  getMyProfile,
  upsertMyProfile,
}
