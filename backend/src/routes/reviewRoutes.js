const express = require("express")

const reviewController = require("../controllers/reviewController")
const authenticate = require("../middleware/auth")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/me", authenticate, asyncHandler(reviewController.getMyReviews))

module.exports = router
