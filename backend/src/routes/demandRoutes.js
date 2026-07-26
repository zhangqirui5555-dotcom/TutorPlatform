const express = require("express")

const applicationController = require("../controllers/applicationController")
const demandController = require("../controllers/demandController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/", authenticate, asyncHandler(demandController.getPublicDemands))
router.get("/:id", authenticate, asyncHandler(demandController.getDemandDetail))
router.post(
  "/",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(demandController.createDemand),
)
router.post(
  "/:demandId/applications",
  authenticate,
  requireRole("STUDENT"),
  asyncHandler(applicationController.submitApplication),
)
router.get(
  "/:demandId/applications",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(applicationController.getDemandApplications),
)
router.post(
  "/:id/publish",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(demandController.publishDemand),
)
router.post(
  "/:id/close",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(demandController.closeDemand),
)

module.exports = router
