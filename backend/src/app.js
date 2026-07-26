const express = require("express")
const cors = require("cors")

const adminRoutes = require("./routes/adminRoutes")
const applicationRoutes = require("./routes/applicationRoutes")
const authRoutes = require("./routes/authRoutes")
const certificationRoutes = require("./routes/certificationRoutes")
const conversationRoutes = require("./routes/conversationRoutes")
const demandRoutes = require("./routes/demandRoutes")
const parentRoutes = require("./routes/parentRoutes")
const reviewRoutes = require("./routes/reviewRoutes")
const studentProfileRoutes = require("./routes/studentProfileRoutes")
const trialLessonRoutes = require("./routes/trialLessonRoutes")
const userRoutes = require("./routes/userRoutes")
const { errorHandler, notFound } = require("./middleware/errorHandler")

const app = express()

app.disable("x-powered-by")
app.use(cors())
app.use(express.json({ limit: "1mb" }))

app.get("/", (req, res) => {
  res.json({
    message: "TutorPlatform backend running",
  })
})

app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/admin", adminRoutes)
app.use("/api/v1/applications", applicationRoutes)
app.use("/api/v1/certifications", certificationRoutes)
app.use("/api/v1/conversations", conversationRoutes)
app.use("/api/v1/demands", demandRoutes)
app.use("/api/v1/parents", parentRoutes)
app.use("/api/v1/reviews", reviewRoutes)
app.use("/api/v1/student-profile", studentProfileRoutes)
app.use("/api/v1/trial-lessons", trialLessonRoutes)
app.use("/api/v1/users", userRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
