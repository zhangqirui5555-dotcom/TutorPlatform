const express = require("express")

const conversationController = require("../controllers/conversationController")
const authenticate = require("../middleware/auth")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.use(authenticate)
router.get("/", asyncHandler(conversationController.getMyConversations))
router.post("/:id/read", asyncHandler(conversationController.markRead))
router.get("/:id/messages", asyncHandler(conversationController.getMessages))
router.post("/:id/messages", asyncHandler(conversationController.sendMessage))

module.exports = router
