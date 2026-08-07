class StorageError extends Error {
  constructor(message, {
    cause,
    code = "STORAGE_ERROR",
    statusCode = 500,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
  }
}

class StorageConfigurationError extends StorageError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: "STORAGE_CONFIGURATION_ERROR",
      statusCode: 500,
    })
  }
}

class StorageConflictError extends StorageError {
  constructor(message = "Stored object already exists", options = {}) {
    super(message, {
      ...options,
      code: "STORAGE_OBJECT_CONFLICT",
      statusCode: 409,
    })
  }
}

class StorageNotFoundError extends StorageError {
  constructor(message = "Stored object not found", options = {}) {
    super(message, {
      ...options,
      code: "STORAGE_OBJECT_NOT_FOUND",
      statusCode: 404,
    })
  }
}

class StorageUnavailableError extends StorageError {
  constructor(message = "Storage is temporarily unavailable", options = {}) {
    super(message, {
      ...options,
      code: "STORAGE_UNAVAILABLE",
      statusCode: 503,
    })
  }
}

class StorageValidationError extends StorageError {
  constructor(message = "Invalid storage key", options = {}) {
    super(message, {
      ...options,
      code: "INVALID_STORAGE_KEY",
      statusCode: 400,
    })
  }
}

module.exports = {
  StorageConfigurationError,
  StorageConflictError,
  StorageError,
  StorageNotFoundError,
  StorageUnavailableError,
  StorageValidationError,
}
