const path = require("node:path")
const {
  StorageConfigurationError,
  StorageValidationError,
} = require("./storageErrors")

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/

function normalizeStorageKey(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new StorageValidationError()
  }

  const normalized = value.trim().replaceAll("\\", "/")
  const segments = normalized.split("/")

  if (
    path.posix.isAbsolute(normalized) ||
    WINDOWS_ABSOLUTE_PATH.test(value.trim()) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new StorageValidationError()
  }

  return normalized
}

function resolveStoragePath(rootDirectory, key) {
  if (typeof rootDirectory !== "string" || !rootDirectory.trim()) {
    throw new StorageConfigurationError("Local storage root is required")
  }

  const normalizedKey = normalizeStorageKey(key)
  const root = path.resolve(rootDirectory)
  const absolutePath = path.resolve(root, ...normalizedKey.split("/"))
  const relativePath = path.relative(root, absolutePath)

  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new StorageValidationError()
  }

  return absolutePath
}

function joinStorageKey(...parts) {
  return normalizeStorageKey(parts.map((part) => String(part)).join("/"))
}

module.exports = {
  joinStorageKey,
  normalizeStorageKey,
  resolveStoragePath,
}
