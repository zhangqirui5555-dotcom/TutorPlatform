const AppError = require("../utils/AppError")

function notFound(req, res, next) {
  next(new AppError(404, "NOT_FOUND", "Route not found"))
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  const statusCode = error.statusCode || 500
  const response = {
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: statusCode === 500 ? "Internal server error" : error.message,
    },
  }

  if (error.details !== undefined) {
    response.error.details = error.details
  }

  if (statusCode === 500) {
    console.error(error)
  }

  res.status(statusCode).json(response)
}

module.exports = {
  errorHandler,
  notFound,
}
