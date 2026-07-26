const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3")
const { PrismaClient } = require("@prisma/client")

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl })
const prisma = new PrismaClient({ adapter })

module.exports = prisma
