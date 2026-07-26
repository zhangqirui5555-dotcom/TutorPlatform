const express = require("express")

const applicationController = require("../controllers/applicationController")
const trialLessonController = require("../controllers/trialLessonController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get(
  "/me",
  authenticate,
  requireRole("STUDENT"),
  asyncHandler(applicationController.getMyApplications),
)
router.post(
  "/:applicationId/trial-lessons",
  authenticate,
  requireRole("PARENT", "STUDENT"),
  asyncHandler(trialLessonController.createTrialLesson),
)
router.post(
  "/:id/accept",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(applicationController.acceptApplication),
)
router.post(
  "/:id/reject",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(applicationController.rejectApplication),
)

module.exports = router
