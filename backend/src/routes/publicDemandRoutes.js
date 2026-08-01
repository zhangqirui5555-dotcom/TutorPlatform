const express = require("express")

const publicDemandController = require("../controllers/publicDemandController")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/featured", asyncHandler(publicDemandController.getFeaturedDemands))
router.get("/:id", asyncHandler(publicDemandController.getPublicDemandDetail))
router.get("/", asyncHandler(publicDemandController.getPublicDemands))

module.exports = router
