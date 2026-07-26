const AppError = require("../utils/AppError")

function requireRole(...allowedRoles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"))
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to access this resource"))
      return
    }

    next()
  }
}

module.exports = requireRole
