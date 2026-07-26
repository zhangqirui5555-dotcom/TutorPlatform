const express = require("express")

const demandController = require("../controllers/demandController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get(
  "/me/demands",
  authenticate,
  requireRole("PARENT"),
  asyncHandler(demandController.getMyDemands),
)

module.exports = router
