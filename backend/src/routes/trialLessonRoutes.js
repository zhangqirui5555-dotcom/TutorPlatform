const express = require("express")

const reviewController = require("../controllers/reviewController")
const trialLessonController = require("../controllers/trialLessonController")
const authenticate = require("../middleware/auth")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate)
router.get("/", asyncHandler(trialLessonController.getMyTrialLessons))
router.post(
  "/:trialLessonId/reviews",
  asyncHandler(reviewController.submitReview),
)
router.get("/:id", asyncHandler(trialLessonController.getTrialLesson))
router.post("/:id/confirm", asyncHandler(trialLessonController.confirmTrialLesson))
router.post("/:id/cancel", asyncHandler(trialLessonController.cancelTrialLesson))
router.post("/:id/complete", asyncHandler(trialLessonController.completeTrialLesson))

module.exports = router
