const certificationService = require("../services/certificationService")

async function submitCertification(req, res) {
  const certification = await certificationService.submitCertification(
    req.user.id,
    req.body || {},
  )
  res.status(201).json({ certification })
}

async function getMyCertifications(req, res) {
  const result = await certificationService.getMyCertifications(req.user.id)
  res.json(result)
}

async function getPendingCertifications(req, res) {
  const certifications = await certificationService.getPendingCertifications()
  res.json({ certifications })
}

async function approveCertification(req, res) {
  const certification = await certificationService.approveCertification(
    Number(req.params.id),
    req.user.id,
  )
  res.json({ certification })
}

async function rejectCertification(req, res) {
  const certification = await certificationService.rejectCertification(
    Number(req.params.id),
    req.user.id,
    req.body || {},
  )
  res.json({ certification })
}

module.exports = {
  approveCertification,
  getMyCertifications,
  getPendingCertifications,
  rejectCertification,
  submitCertification,
}
