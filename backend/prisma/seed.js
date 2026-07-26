require("dotenv/config")

const bcrypt = require("bcrypt")
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3")
const { PrismaClient } = require("@prisma/client")

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database")
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl })
const prisma = new PrismaClient({ adapter })

const TEST_PASSWORD = "Test123456!"

async function main() {
  const testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {
      displayName: "测试管理员",
      passwordHash: testPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      email: "admin@test.com",
      displayName: "测试管理员",
      passwordHash: testPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  })

  const parent = await prisma.user.upsert({
    where: { email: "parent@test.com" },
    update: {
      displayName: "测试家长",
      passwordHash: testPasswordHash,
      role: "PARENT",
      status: "ACTIVE",
    },
    create: {
      email: "parent@test.com",
      displayName: "测试家长",
      passwordHash: testPasswordHash,
      role: "PARENT",
      status: "ACTIVE",
    },
  })

  const student = await prisma.user.upsert({
    where: { email: "student@test.com" },
    update: {
      displayName: "测试大学生",
      passwordHash: testPasswordHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
    create: {
      email: "student@test.com",
      displayName: "测试大学生",
      passwordHash: testPasswordHash,
      role: "STUDENT",
      status: "ACTIVE",
    },
  })

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      school: "测试大学",
      major: "数学与应用数学",
      grade: "大三",
      subjects: JSON.stringify(["MATH"]),
      teachingExperience: "Demo 测试教学经历",
      bio: "TutorPlatform Demo 学生资料",
      expectedPriceMin: 8000,
      expectedPriceMax: 15000,
      priceUnit: "PER_HOUR",
      currency: "CNY",
      teachingRegions: JSON.stringify(["DEMO_REGION"]),
    },
    create: {
      userId: student.id,
      school: "测试大学",
      major: "数学与应用数学",
      grade: "大三",
      subjects: JSON.stringify(["MATH"]),
      teachingExperience: "Demo 测试教学经历",
      bio: "TutorPlatform Demo 学生资料",
      expectedPriceMin: 8000,
      expectedPriceMax: 15000,
      priceUnit: "PER_HOUR",
      currency: "CNY",
      teachingRegions: JSON.stringify(["DEMO_REGION"]),
    },
  })

  const certification = await prisma.certification.findFirst({
    where: {
      studentId: student.id,
      materialPath: "uploads/certifications/demo/student-card.jpg",
    },
  })

  if (certification) {
    await prisma.certification.update({
      where: { id: certification.id },
      data: {
        materialType: "STUDENT_CARD",
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: admin.id,
        rejectionReason: null,
      },
    })
  } else {
    await prisma.certification.create({
      data: {
        studentId: student.id,
        materialPath: "uploads/certifications/demo/student-card.jpg",
        materialType: "STUDENT_CARD",
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: admin.id,
      },
    })
  }

  const demand = await prisma.demand.findFirst({
    where: {
      parentId: parent.id,
      title: "初中数学家教（Demo）",
    },
  })

  const demandData = {
    childGrade: "初二",
    subject: "MATH",
    region: "DEMO_REGION",
    scheduleDescription: "周末下午",
    budgetMin: 10000,
    budgetMax: 18000,
    priceUnit: "PER_HOUR",
    currency: "CNY",
    description: "用于 TutorPlatform Demo 的测试需求",
    status: "RECRUITING",
    publishedAt: new Date(),
  }

  if (demand) {
    await prisma.demand.update({
      where: { id: demand.id },
      data: demandData,
    })
  } else {
    await prisma.demand.create({
      data: {
        parentId: parent.id,
        title: "初中数学家教（Demo）",
        ...demandData,
      },
    })
  }

  console.log("Seed completed: admin, parent, student, profile, certification, and demand")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
