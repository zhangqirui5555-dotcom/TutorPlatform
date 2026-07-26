const express = require("express")

const reviewController = require("../controllers/reviewController")
const userController = require("../controllers/userController")
const authenticate = require("../middleware/auth")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/me", authenticate, userController.getCurrentUser)
router.get(
  "/:userId/reviews",
  authenticate,
  asyncHandler(reviewController.getReceivedReviews),
)

module.exports = router
