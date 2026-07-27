const express = require("express")

const certificationController = require("../controllers/certificationController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate, requireRole("STUDENT"))
router.post("/", asyncHandler(certificationController.submitCertification))
router.post("/upload", asyncHandler(certificationController.uploadCertification))
router.get("/me", asyncHandler(certificationController.getMyCertifications))

module.exports = router
