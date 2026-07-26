const prisma = require("../prisma/client")
const AppError = require("../utils/AppError")
const { verifyToken } = require("../utils/jwt")

async function authenticate(req, res, next) {
  try {
    const authorization = req.get("authorization")

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Bearer token is required")
    }

    const token = authorization.slice("Bearer ".length).trim()
    const payload = verifyToken(token)
    const userId = Number(payload.sub)

    if (!Number.isInteger(userId)) {
      throw new AppError(401, "INVALID_TOKEN", "Token is invalid")
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        displayName: true,
      },
    })

    if (!user || user.status !== "ACTIVE") {
      throw new AppError(401, "INVALID_TOKEN", "Token user is unavailable")
    }

    req.user = user
    next()
  } catch (error) {
    if (error instanceof AppError) {
      next(error)
      return
    }

    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      next(new AppError(401, "INVALID_TOKEN", "Token is invalid or expired"))
      return
    }

    next(error)
  }
}

module.exports = authenticate
