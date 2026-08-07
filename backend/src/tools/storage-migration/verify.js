const { readStreamWithHash } = require("./hash")
const { MIGRATION_STATUSES } = require("./manifest")
const { withRetry } = require("./retry")

function safeErrorCode(error, fallback = "VERIFY_FAILED") {
  if (typeof error?.code === "string" && error.code) return error.code
  return fallback
}

async function verifyMigration({
  entries,
  destinationAdapter,
  manifestStore,
  dryRun = false,
  retryOptions = {},
  hashOptions = {},
  clock = () => new Date(),
}) {
  if (!Array.isArray(entries)) throw new TypeError("Manifest entries are required")
  if (!destinationAdapter?.exists || !destinationAdapter?.read) {
    throw new TypeError("A destination adapter is required")
  }

  const results = []
  for (const original of entries) {
    let result
    try {
      const exists = await withRetry(
        () => destinationAdapter.exists(original.materialPath),
        retryOptions,
      )
      if (!exists) {
        result = {
          ...original,
          destinationSize: null,
          destinationSha256: null,
          status: MIGRATION_STATUSES.FAILED,
          verifiedAt: null,
          errorCode: "DESTINATION_MISSING",
        }
      } else {
        const destination = await withRetry(
          async () => {
            const material = await destinationAdapter.read(original.materialPath)
            return readStreamWithHash(material.stream, hashOptions)
          },
          retryOptions,
        )
        const matches = original.sourceSize === destination.size
          && original.sourceSha256 === destination.sha256
        result = {
          ...original,
          destinationSize: destination.size,
          destinationSha256: destination.sha256,
          status: matches
            ? (original.status === MIGRATION_STATUSES.ALREADY_EXISTS_AND_MATCHED
              ? original.status
              : MIGRATION_STATUSES.MIGRATED)
            : MIGRATION_STATUSES.HASH_CONFLICT,
          verifiedAt: matches ? clock().toISOString() : null,
          errorCode: matches ? null : "HASH_CONFLICT",
        }
      }
    } catch (error) {
      result = {
        ...original,
        status: MIGRATION_STATUSES.FAILED,
        verifiedAt: null,
        errorCode: safeErrorCode(error),
      }
    }

    if (!dryRun && manifestStore) await manifestStore.upsert(result)
    results.push(result)
  }
  return results
}

module.exports = { verifyMigration }
