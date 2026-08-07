const {
  StorageConflictError,
  StorageNotFoundError,
} = require("../../storage/storageErrors")
const { readStreamWithHash } = require("./hash")
const { normalizeMigrationPath } = require("./inventory")
const { MIGRATION_STATUSES } = require("./manifest")
const { withRetry } = require("./retry")

const SUCCESS_STATUSES = new Set([
  MIGRATION_STATUSES.MIGRATED,
  MIGRATION_STATUSES.ALREADY_EXISTS_AND_MATCHED,
])

class MigrationInterruptedError extends Error {
  constructor() {
    super("Storage migration interrupted")
    this.name = "MigrationInterruptedError"
    this.code = "MIGRATION_INTERRUPTED"
  }
}

function safeErrorCode(error, fallback = "MIGRATION_FAILED") {
  if (typeof error?.code === "string" && error.code) return error.code
  return fallback
}

function isMissing(error) {
  return error instanceof StorageNotFoundError
    || error?.code === "STORAGE_OBJECT_NOT_FOUND"
    || error?.code === "ENOENT"
}

function baseEntry(certification, materialPath, previous, attempts) {
  return {
    certificationId: certification.id,
    studentId: certification.studentId,
    materialPath,
    certificationStatus: certification.status,
    sourceSize: null,
    sourceSha256: null,
    destinationSize: null,
    destinationSha256: null,
    status: MIGRATION_STATUSES.FAILED,
    attempts: (previous?.attempts || 0) + attempts,
    verifiedAt: null,
    errorCode: null,
  }
}

async function readHashed(adapter, key, options) {
  const material = await adapter.read(key)
  const hashed = await readStreamWithHash(material.stream, options)
  return { ...hashed, contentType: material.contentType }
}

async function migrateCertifications({
  certifications,
  sourceAdapter,
  destinationAdapter,
  manifestStore,
  checkpointStore,
  storagePrefix = "uploads/certifications",
  resume = false,
  dryRun = false,
  retryOptions = {},
  hashOptions = {},
  clock = () => new Date(),
  signal,
  onProgress,
}) {
  if (!Array.isArray(certifications)) throw new TypeError("Certifications are required")
  if (!sourceAdapter?.read) throw new TypeError("A source adapter is required")
  if (!destinationAdapter?.read || !destinationAdapter?.upload) {
    throw new TypeError("A destination adapter is required")
  }
  if (!dryRun && (!manifestStore || !checkpointStore)) {
    throw new TypeError("Manifest and checkpoint stores are required")
  }

  const results = []

  async function finish(entry, { completed = false } = {}) {
    let recorded = entry
    if (!dryRun) {
      recorded = await manifestStore.upsert(entry)
      if (completed) await checkpointStore.markCompleted(recorded.certificationId)
    }
    results.push(recorded)
    await onProgress?.(recorded)
    return recorded
  }

  for (const certification of certifications) {
    if (signal?.aborted) throw new MigrationInterruptedError()

    const previous = dryRun ? null : await manifestStore.find(certification.id)
    if (resume && previous && SUCCESS_STATUSES.has(previous.status)) {
      if (!(await checkpointStore.has(certification.id))) {
        await checkpointStore.markCompleted(certification.id)
      }
      results.push(previous)
      continue
    }

    let materialPath = certification.materialPath
    try {
      materialPath = normalizeMigrationPath(materialPath, storagePrefix)
    } catch (error) {
      await finish({
        ...baseEntry(certification, materialPath, previous, 1),
        errorCode: safeErrorCode(error, "INVALID_MATERIAL_PATH"),
      })
      continue
    }

    let source
    try {
      source = await readHashed(sourceAdapter, materialPath, hashOptions)
    } catch (error) {
      await finish({
        ...baseEntry(certification, materialPath, previous, 1),
        status: isMissing(error)
          ? MIGRATION_STATUSES.SOURCE_MISSING
          : MIGRATION_STATUSES.FAILED,
        errorCode: safeErrorCode(error),
      })
      continue
    }

    let operationAttempts = 1
    const retry = (operation) => withRetry(operation, {
      ...retryOptions,
      onAttempt: (attempt) => {
        operationAttempts = Math.max(operationAttempts, attempt)
        retryOptions.onAttempt?.(attempt)
      },
    })
    const entryFromSource = () => ({
      ...baseEntry(certification, materialPath, previous, operationAttempts),
      sourceSize: source.size,
      sourceSha256: source.sha256,
    })

    let destinationExists
    try {
      destinationExists = await retry(() => destinationAdapter.exists(materialPath))
    } catch (error) {
      await finish({
        ...entryFromSource(),
        errorCode: safeErrorCode(error),
      })
      continue
    }

    if (!destinationExists && dryRun) {
      await finish({
        ...entryFromSource(),
        status: MIGRATION_STATUSES.WOULD_MIGRATE,
      })
      continue
    }

    let uploaded = false
    if (!destinationExists) {
      try {
        await retry(() => destinationAdapter.upload({
          key: materialPath,
          body: source.body,
          contentType: source.contentType,
          contentLength: source.size,
          checksum: source.sha256,
        }))
        uploaded = true
      } catch (error) {
        if (!(error instanceof StorageConflictError)
          && error?.code !== "STORAGE_OBJECT_CONFLICT") {
          await finish({
            ...entryFromSource(),
            errorCode: safeErrorCode(error),
          })
          continue
        }
      }
    }

    let destination
    try {
      destination = await retry(
        () => readHashed(destinationAdapter, materialPath, hashOptions),
      )
    } catch (error) {
      await finish({
        ...entryFromSource(),
        errorCode: safeErrorCode(error),
      })
      continue
    }

    const matches = source.size === destination.size
      && source.sha256 === destination.sha256
    await finish({
      ...entryFromSource(),
      destinationSize: destination.size,
      destinationSha256: destination.sha256,
      status: matches
        ? (uploaded
          ? MIGRATION_STATUSES.MIGRATED
          : MIGRATION_STATUSES.ALREADY_EXISTS_AND_MATCHED)
        : MIGRATION_STATUSES.HASH_CONFLICT,
      verifiedAt: matches ? clock().toISOString() : null,
      errorCode: matches ? null : "HASH_CONFLICT",
    }, { completed: matches })
  }

  return results
}

module.exports = {
  MigrationInterruptedError,
  SUCCESS_STATUSES,
  migrateCertifications,
}
