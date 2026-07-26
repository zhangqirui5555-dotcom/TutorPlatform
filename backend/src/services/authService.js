const bcrypt = require("bcrypt")

const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const { signToken } = require("../utils/jwt")
const toUserResponse = require("../utils/userResponse")

const ALLOWED_REGISTRATION_ROLES = new Set(["PARENT", "STUDENT"])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BCRYPT_ROUNDS = 12

function validateRegistrationInput({ email, password, display_name: displayName, role }) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
  const normalizedDisplayName = typeof displayName === "string" ? displayName.trim() : ""
  const normalizedRole = typeof role === "string" ? role.trim().toUpperCase() : ""

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new AppError(400, "INVALID_EMAIL", "A valid email is required")
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new AppError(400, "INVALID_PASSWORD", "Password must be at least 8 characters")
  }

  if (!normalizedDisplayName) {
    throw new AppError(400, "INVALID_DISPLAY_NAME", "display_name is required")
  }

  if (!ALLOWED_REGISTRATION_ROLES.has(normalizedRole)) {
    throw new AppError(400, "INVALID_ROLE", "role must be PARENT or STUDENT")
  }

  return {
    email: normalizedEmail,
    password,
    displayName: normalizedDisplayName,
    role: normalizedRole,
  }
}

async function register(input) {
  const validated = validateRegistrationInput(input)
  const existingUser = await prisma.user.findUnique({
    where: { email: validated.email },
    select: { id: true },
  })

  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered")
  }

  const passwordHash = await bcrypt.hash(validated.password, BCRYPT_ROUNDS)

  try {
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        displayName: validated.displayName,
        role: validated.role,
        status: "ACTIVE",
      },
    })

    return {
      token: signToken(user),
      user: toUserResponse(user),
    }
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered")
    }

    throw error
  }
}

async function login({ email, password }) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

  if (!normalizedEmail || typeof password !== "string") {
    throw new AppError(400, "INVALID_CREDENTIALS", "Email and password are required")
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "Account is not active")
  }

  return {
    token: signToken(user),
    user: toUserResponse(user),
  }
}

module.exports = {
  login,
  register,
}
