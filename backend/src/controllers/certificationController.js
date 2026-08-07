const certificationService = require("../services/certificationService")
const certificationMaterialService = require("../services/certificationMaterialService")
const { pipeline } = require("node:stream/promises")

async function uploadCertification(req, res) {
  const certification = await certificationMaterialService.uploadCertification(
    req.user.id,
    req.body || {},
  )
  res.status(201).json({ certification })
}

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

async function sendCertificationMaterial(material, res) {
  res.setHeader("Content-Type", material.contentType)
  if (Number.isInteger(material.contentLength)) {
    res.setHeader("Content-Length", String(material.contentLength))
  }
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("X-Content-Type-Options", "nosniff")
  await pipeline(material.stream, res)
}

async function getMyCertificationMaterial(req, res) {
  const { material } = await certificationMaterialService.getCertificationMaterial(
    Number(req.params.id),
    req.user.id,
  )
  await sendCertificationMaterial(material, res)
}

async function getCertificationMaterialForAdmin(req, res) {
  const { material } = await certificationMaterialService.getCertificationMaterial(
    Number(req.params.id),
  )
  await sendCertificationMaterial(material, res)
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
  getMyCertificationMaterial,
  getCertificationMaterialForAdmin,
  getPendingCertifications,
  rejectCertification,
  submitCertification,
  uploadCertification,
}

