const path = require("node:path")

const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toCertificationResponse = require("../utils/certificationResponse")

function validateMaterialPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_MATERIAL_PATH", "material_path is required")
  }

  const normalized = value.trim().replaceAll("\\", "/")

  if (
    path.posix.isAbsolute(normalized) ||
    !normalized.startsWith("uploads/") ||
    normalized.split("/").includes("..")
  ) {
    throw new AppError(
      400,
      "INVALID_MATERIAL_PATH",
      "material_path must be a relative path inside uploads/",
    )
  }

  return normalized
}

function requireMaterialType(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_MATERIAL_TYPE", "material_type is required")
  }

  return value.trim().toUpperCase()
}

async function submitCertification(studentId, input) {
  const materialPath = validateMaterialPath(input.material_path)
  const materialType = requireMaterialType(input.material_type)

  try {
    const certification = await prisma.$transaction(async (transaction) => {
      const pending = await transaction.certification.findFirst({
        where: {
          studentId,
          status: "PENDING",
        },
        select: { id: true },
      })

      if (pending) {
        throw new AppError(
          409,
          "PENDING_CERTIFICATION_EXISTS",
          "A pending certification already exists",
        )
      }

      return transaction.certification.create({
        data: {
          studentId,
          materialPath,
          materialType,
          status: "PENDING",
        },
      })
    })

    return toCertificationResponse(certification)
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw error
  }
}

async function getMyCertifications(studentId) {
  const certifications = await prisma.certification.findMany({
    where: { studentId },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
  })

  return {
    current_status: certifications[0]?.status || "NOT_SUBMITTED",
    history: certifications.map(toCertificationResponse),
  }
}

async function getPendingCertifications() {
  const certifications = await prisma.certification.findMany({
    where: { status: "PENDING" },
    include: {
      student: {
        select: {
          id: true,
          email: true,
          displayName: true,
          studentProfile: {
            select: {
              school: true,
              major: true,
              grade: true,
            },
          },
        },
      },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  })

  return certifications.map(toCertificationResponse)
}

async function findCertification(certificationId) {
  if (!Number.isInteger(certificationId) || certificationId <= 0) {
    throw new AppError(
      400,
      "INVALID_CERTIFICATION_ID",
      "Certification ID must be a positive integer",
    )
  }

  const certification = await prisma.certification.findUnique({
    where: { id: certificationId },
  })

  if (!certification) {
    throw new AppError(404, "CERTIFICATION_NOT_FOUND", "Certification not found")
  }

  return certification
}

async function getCertificationMaterial(certificationId, studentId = null) {
  const certification = await findCertification(certificationId)

  if (studentId !== null && certification.studentId !== studentId) {
    throw new AppError(403, "FORBIDDEN", "You cannot access this certification material")
  }

  return certification
}

async function reviewCertification(certificationId, adminId, decision, rejectionReason = null) {
  const certification = await findCertification(certificationId)

  if (certification.status !== "PENDING") {
    throw new AppError(
      409,
      "CERTIFICATION_ALREADY_REVIEWED",
      "Only PENDING certifications can be reviewed",
    )
  }

  const result = await prisma.certification.updateMany({
    where: {
      id: certification.id,
      status: "PENDING",
    },
    data: {
      status: decision,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason,
    },
  })

  if (result.count !== 1) {
    throw new AppError(
      409,
      "CERTIFICATION_ALREADY_REVIEWED",
      "Certification was reviewed by another administrator",
    )
  }

  const reviewed = await prisma.certification.findUnique({
    where: { id: certification.id },
  })

  return toCertificationResponse(reviewed)
}

async function approveCertification(certificationId, adminId) {
  return reviewCertification(certificationId, adminId, "APPROVED")
}

async function rejectCertification(certificationId, adminId, input) {
  const rejectionReason =
    typeof input.rejection_reason === "string" ? input.rejection_reason.trim() : ""

  if (!rejectionReason) {
    throw new AppError(400, "REJECTION_REASON_REQUIRED", "rejection_reason is required")
  }

  return reviewCertification(certificationId, adminId, "REJECTED", rejectionReason)
}

module.exports = {
  approveCertification,
  getMyCertifications,
  getPendingCertifications,
  getCertificationMaterial,
  rejectCertification,
  submitCertification,
}

