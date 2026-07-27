const certificationService = require("../services/certificationService")
const crypto = require("node:crypto")
const fs = require("node:fs/promises")
const path = require("node:path")
const AppError = require("../utils/AppError")

const MATERIAL_TYPES = {
  "application/pdf": { extension: ".pdf", type: "STUDENT_CERTIFICATE" },
  "image/jpeg": { extension: ".jpg", type: "STUDENT_CERTIFICATE" },
  "image/png": { extension: ".png", type: "STUDENT_CERTIFICATE" },
}
const MAX_FILE_SIZE = 1024 * 1024

async function uploadCertification(req, res) {
  const { data_base64: dataBase64, mime_type: mimeType } = req.body || {}
  const material = MATERIAL_TYPES[mimeType]

  if (!material || typeof dataBase64 !== "string" || !dataBase64) {
    throw new AppError(
      400,
      "INVALID_CERTIFICATION_FILE",
      "Only JPG, PNG, or PDF certification files are supported",
    )
  }

  const buffer = Buffer.from(dataBase64, "base64")
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) {
    throw new AppError(
      400,
      "INVALID_CERTIFICATION_FILE_SIZE",
      "Certification file must not exceed 1 MB",
    )
  }

  const relativePath = `uploads/certifications/${req.user.id}/${crypto.randomUUID()}${material.extension}`
  const absolutePath = path.join(__dirname, "..", "..", relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  try {
    const certification = await certificationService.submitCertification(req.user.id, {
      material_path: relativePath,
      material_type: material.type,
    })
    res.status(201).json({ certification })
  } catch (error) {
    await fs.rm(absolutePath, { force: true })
    throw error
  }
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
  uploadCertification,
}
