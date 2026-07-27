const express = require("express")

const certificationController = require("../controllers/certificationController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate, requireRole("ADMIN"))
router.get(
  "/certifications",
  asyncHandler(certificationController.getPendingCertifications),
)
router.get(
  "/certifications/:id/material",
  asyncHandler(certificationController.getCertificationMaterialForAdmin),
)
router.post(
  "/certifications/:id/approve",
  asyncHandler(certificationController.approveCertification),
)
router.post(
  "/certifications/:id/reject",
  asyncHandler(certificationController.rejectCertification),
)

module.exports = router

