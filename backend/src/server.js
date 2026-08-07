require("dotenv").config()

const { getStorageAdapter } = require("./storage")

getStorageAdapter()

const app = require("./app")
const prisma = require("./prisma/client")

const port = Number(process.env.PORT) || 3000
const server = app.listen(port, () => {
  console.log(`TutorPlatform backend running on port ${port}`)
})

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`)

  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
