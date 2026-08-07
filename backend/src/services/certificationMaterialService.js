const crypto = require("node:crypto")

const { getStorageAdapter } = require("../storage")
const { joinStorageKey, normalizeStorageKey } = require("../storage/storageKey")
const AppError = require("../utils/AppError")

const MATERIAL_TYPES = {
  "application/pdf": { extension: ".pdf", type: "STUDENT_CERTIFICATE" },
  "image/jpeg": { extension: ".jpg", type: "STUDENT_CERTIFICATE" },
  "image/png": { extension: ".png", type: "STUDENT_CERTIFICATE" },
}
const MAX_FILE_SIZE = 1024 * 1024
const DEFAULT_PREFIX = "uploads/certifications"

function createCertificationMaterialService({
  storageAdapter,
  certificationRepository,
  storagePrefix = process.env.CERTIFICATION_STORAGE_PREFIX || DEFAULT_PREFIX,
  createId = crypto.randomUUID,
  logger = console,
} = {}) {
  const adapter = storageAdapter || getStorageAdapter()
  const repository = certificationRepository || require("./certificationService")
  const normalizedPrefix = normalizeStorageKey(storagePrefix)

  async function uploadCertification(studentId, input) {
    const { data_base64: dataBase64, mime_type: mimeType } = input || {}
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

    const checksum = crypto.createHash("sha256").update(buffer).digest("hex")
    const key = joinStorageKey(
      normalizedPrefix,
      studentId,
      `${createId()}${material.extension}`,
    )

    await adapter.upload({
      key,
      body: buffer,
      contentType: mimeType,
      contentLength: buffer.length,
      checksum,
    })

    try {
      return await repository.submitCertification(studentId, {
        material_path: key,
        material_type: material.type,
      })
    } catch (error) {
      try {
        await adapter.delete(key)
      } catch (cleanupError) {
        logger.error("Certification storage rollback failed", {
          key,
          error: cleanupError,
        })
      }
      throw error
    }
  }

  async function getCertificationMaterial(certificationId, studentId = null) {
    const certification = await repository.getCertificationMaterial(
      certificationId,
      studentId,
    )
    const material = await adapter.read(certification.materialPath)

    return { certification, material }
  }

  return {
    getCertificationMaterial,
    uploadCertification,
  }
}

let defaultService

function getDefaultService() {
  if (!defaultService) defaultService = createCertificationMaterialService()
  return defaultService
}

async function uploadCertification(...args) {
  return getDefaultService().uploadCertification(...args)
}

async function getCertificationMaterial(...args) {
  return getDefaultService().getCertificationMaterial(...args)
}

module.exports = {
  createCertificationMaterialService,
  getCertificationMaterial,
  uploadCertification,
}
