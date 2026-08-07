const { normalizeStorageKey } = require("../../storage/storageKey")

const CERTIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"]

function normalizeMigrationPath(value, prefix = "uploads/certifications") {
  const normalized = normalizeStorageKey(value)
  const normalizedPrefix = normalizeStorageKey(prefix)
  if (normalized !== normalizedPrefix && !normalized.startsWith(`${normalizedPrefix}/`)) {
    const error = new Error("Certification material path is outside the migration prefix")
    error.code = "INVALID_MATERIAL_PATH"
    throw error
  }
  return normalized
}

function safeErrorCode(error, fallback = "INVENTORY_FAILED") {
  if (typeof error?.code === "string" && error.code) return error.code
  return fallback
}

async function inventoryCertifications({
  certificationRepository,
  sourceAdapter,
  storagePrefix = "uploads/certifications",
}) {
  if (!certificationRepository?.listCertifications) {
    throw new TypeError("A read-only certification repository is required")
  }
  if (!sourceAdapter?.exists) throw new TypeError("A source adapter is required")

  const certifications = await certificationRepository.listCertifications()
  const normalizedRecords = certifications.map((certification) => {
    try {
      return {
        certification,
        materialPath: normalizeMigrationPath(certification.materialPath, storagePrefix),
        pathValid: true,
      }
    } catch (error) {
      return {
        certification,
        materialPath: certification.materialPath,
        pathValid: false,
        errorCode: safeErrorCode(error, "INVALID_MATERIAL_PATH"),
      }
    }
  })
  const keyCounts = new Map()
  for (const record of normalizedRecords) {
    if (record.pathValid) {
      keyCounts.set(record.materialPath, (keyCounts.get(record.materialPath) || 0) + 1)
    }
  }

  const entries = []
  for (const record of normalizedRecords) {
    let sourceExists = null
    let errorCode = record.errorCode || null
    if (record.pathValid) {
      try {
        sourceExists = await sourceAdapter.exists(record.materialPath)
      } catch (error) {
        errorCode = safeErrorCode(error)
      }
    }

    entries.push({
      certificationId: record.certification.id,
      studentId: record.certification.studentId,
      materialPath: record.materialPath,
      certificationStatus: record.certification.status,
      pathValid: record.pathValid,
      duplicateKey: record.pathValid && keyCounts.get(record.materialPath) > 1,
      sourceExists,
      errorCode,
    })
  }

  const statusCounts = Object.fromEntries(
    CERTIFICATION_STATUSES.map((status) => [status, 0]),
  )
  for (const certification of certifications) {
    statusCounts[certification.status] = (statusCounts[certification.status] || 0) + 1
  }

  const duplicateKeys = [...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([materialPath, recordCount]) => ({ materialPath, recordCount }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: certifications.length,
      statusCounts,
      invalidPaths: entries.filter((entry) => !entry.pathValid).length,
      duplicateKeys: duplicateKeys.length,
      duplicateRecords: entries.filter((entry) => entry.duplicateKey).length,
      sourceMissing: entries.filter((entry) => entry.sourceExists === false).length,
      sourceCheckFailed: entries.filter(
        (entry) => entry.pathValid && entry.sourceExists === null,
      ).length,
    },
    duplicateKeys,
    entries,
    certifications,
  }
}

function createPrismaCertificationRepository(prisma) {
  return {
    async listCertifications() {
      return prisma.certification.findMany({
        select: {
          id: true,
          studentId: true,
          materialPath: true,
          materialType: true,
          status: true,
          submittedAt: true,
        },
        orderBy: { id: "asc" },
      })
    },
  }
}

module.exports = {
  CERTIFICATION_STATUSES,
  createPrismaCertificationRepository,
  inventoryCertifications,
  normalizeMigrationPath,
}
