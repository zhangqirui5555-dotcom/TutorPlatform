const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const toStudentProfileResponse = require("../utils/studentProfileResponse")

function requireText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_STUDENT_PROFILE", `${fieldName} is required`)
  }

  return value.trim()
}

function optionalText(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_STUDENT_PROFILE", `${fieldName} must be a string`)
  }

  return value.trim() || null
}

function requireStringArray(value, fieldName) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new AppError(
      400,
      "INVALID_STUDENT_PROFILE",
      `${fieldName} must be a non-empty array of strings`,
    )
  }

  return [...new Set(value.map((item) => item.trim()))]
}

function optionalPrice(value, fieldName) {
  if (value === undefined || value === null) {
    return null
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(
      400,
      "INVALID_EXPECTED_PRICE",
      `${fieldName} must be a non-negative integer in cents`,
    )
  }

  return value
}

function validateProfileInput(input) {
  const expectedPriceMin = optionalPrice(input.expected_price_min, "expected_price_min")
  const expectedPriceMax = optionalPrice(input.expected_price_max, "expected_price_max")

  if (
    expectedPriceMin !== null &&
    expectedPriceMax !== null &&
    expectedPriceMin > expectedPriceMax
  ) {
    throw new AppError(
      400,
      "INVALID_EXPECTED_PRICE_RANGE",
      "expected_price_min cannot be greater than expected_price_max",
    )
  }

  return {
    school: requireText(input.school, "school"),
    major: requireText(input.major, "major"),
    grade: requireText(input.grade, "grade"),
    subjects: JSON.stringify(requireStringArray(input.subjects, "subjects")),
    teachingExperience: optionalText(input.teaching_experience, "teaching_experience"),
    bio: optionalText(input.bio, "bio"),
    expectedPriceMin,
    expectedPriceMax,
    teachingRegions: JSON.stringify(
      requireStringArray(input.teaching_regions, "teaching_regions"),
    ),
  }
}

async function upsertMyProfile(studentId, input) {
  const data = validateProfileInput(input)
  const profile = await prisma.studentProfile.upsert({
    where: { userId: studentId },
    update: data,
    create: {
      ...data,
      userId: studentId,
    },
  })

  return toStudentProfileResponse(profile)
}

async function getMyProfile(studentId) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  })

  if (!profile) {
    throw new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Student profile not found")
  }

  return toStudentProfileResponse(profile)
}

module.exports = {
  getMyProfile,
  upsertMyProfile,
}
