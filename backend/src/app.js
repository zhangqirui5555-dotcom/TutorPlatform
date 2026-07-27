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
const AppError = require("./utils/AppError")

const app = express()

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.disable("x-powered-by")
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new AppError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed by CORS"))
    },
  }),
)
app.use(express.json({ limit: "2mb" }))

app.get(["/", "/health"], (req, res) => {
  res.json({
    status: "ok",
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

