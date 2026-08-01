const express = require("express")

const adminController = require("../controllers/adminController")
const certificationController = require("../controllers/certificationController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate, requireRole("ADMIN"))
router.get("/users", asyncHandler(adminController.getUsers))
router.patch("/users/:id/status", asyncHandler(adminController.updateUserStatus))
router.get("/governance", asyncHandler(adminController.getGovernanceOverview))
router.get("/demands", asyncHandler(adminController.getDemands))
router.patch(
  "/demands/:id/visibility",
  asyncHandler(adminController.updateDemandVisibility),
)
router.patch(
  "/demands/:id/feature",
  asyncHandler(adminController.updateDemandFeature),
)
router.patch(
  "/demands/:id/expiry",
  asyncHandler(adminController.updateDemandExpiry),
)
router.get(
  "/demands/:id/operation-logs",
  asyncHandler(adminController.getDemandOperationLogs),
)
router.post("/demands/:id/close", asyncHandler(adminController.closeDemand))
router.post("/demands/:id/reopen", asyncHandler(adminController.reopenDemand))
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

