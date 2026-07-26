const jwt = require("jsonwebtoken")

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error("JWT_SECRET is required")
  }

  return secret
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  )
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

module.exports = {
  signToken,
  verifyToken,
}
