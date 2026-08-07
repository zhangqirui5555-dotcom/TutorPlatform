const express = require("express")

const orderController = require("../controllers/orderController")
const authenticate = require("../middleware/auth")
const requireRole = require("../middleware/role")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate, requireRole("PARENT", "STUDENT", "ADMIN"))
router.get("/", asyncHandler(orderController.getOrders))
router.get("/:id", asyncHandler(orderController.getOrder))
router.patch("/:id/terms", asyncHandler(orderController.updateTerms))
router.patch("/:id/confirm", asyncHandler(orderController.confirmOrder))
router.patch("/:id/complete", asyncHandler(orderController.completeOrder))
router.patch("/:id/cancel", asyncHandler(orderController.cancelOrder))

module.exports = router
