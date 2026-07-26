const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("@prisma/client")

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

module.exports = prisma
