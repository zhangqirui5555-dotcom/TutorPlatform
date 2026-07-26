const express = require("express")

const studentProfileController = require("../controllers/studentProfileController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate, requireRole("STUDENT"))
router.get("/me", asyncHandler(studentProfileController.getMyProfile))
router.put("/me", asyncHandler(studentProfileController.upsertMyProfile))

module.exports = router
