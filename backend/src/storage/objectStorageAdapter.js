const { Readable, PassThrough } = require("node:stream")
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3")

const StorageAdapter = require("./storageAdapter")
const {
  StorageConfigurationError,
  StorageConflictError,
  StorageError,
  StorageNotFoundError,
  StorageUnavailableError,
} = require("./storageErrors")
const { normalizeStorageKey } = require("./storageKey")

const NOT_FOUND_CODES = new Set(["NoSuchKey", "NotFound", "NoSuchObject"])
const CONFLICT_CODES = new Set([
  "ConditionalRequestConflict",
  "PreconditionFailed",
])

function providerErrorCode(error) {
  return error?.name || error?.Code || error?.code
}

function providerStatusCode(error) {
  return error?.$metadata?.httpStatusCode || error?.statusCode || error?.status
}

function isNotFoundError(error) {
  return providerStatusCode(error) === 404 || NOT_FOUND_CODES.has(providerErrorCode(error))
}

function objectStorageFailure(error, action) {
  if (error instanceof StorageError) return error
  if (isNotFoundError(error)) {
    return new StorageNotFoundError(undefined, { cause: error })
  }
  if (
    [409, 412].includes(providerStatusCode(error)) ||
    CONFLICT_CODES.has(providerErrorCode(error))
  ) {
    return new StorageConflictError(undefined, { cause: error })
  }
  return new StorageUnavailableError(`Unable to ${action} stored object`, {
    cause: error,
  })
}

function toReadable(body) {
  if (!body) {
    throw new StorageUnavailableError("Object storage returned an empty body")
  }
  if (typeof body.pipe === "function") return body
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return Readable.from([body])
  }
  if (typeof body[Symbol.asyncIterator] === "function") return Readable.from(body)
  throw new StorageUnavailableError("Object storage returned an unreadable body")
}

function protectedStream(body) {
  const source = toReadable(body)
  const stream = new PassThrough()

  source.on("error", (error) => {
    stream.destroy(objectStorageFailure(error, "read"))
  })
  stream.on("close", () => source.destroy?.())
  source.pipe(stream)

  return stream
}

function createObjectStorageProviderClient(config, { client } = {}) {
  const s3Client = client || new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return {
    async putObject(input) {
      const result = await s3Client.send(new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        Metadata: input.checksum ? { sha256: input.checksum } : undefined,
      }))
      return { etag: result.ETag || null }
    },

    async getObject({ bucket, key }) {
      const result = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }))
      return {
        body: result.Body,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        checksum: result.Metadata?.sha256 || null,
        etag: result.ETag || null,
      }
    },

    async headObject({ bucket, key }) {
      const result = await s3Client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }))
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        checksum: result.Metadata?.sha256 || null,
        etag: result.ETag || null,
      }
    },

    async deleteObject({ bucket, key }) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }))
    },
  }
}

class ObjectStorageAdapter extends StorageAdapter {
  constructor({ bucket, providerClient }) {
    super()
    if (typeof bucket !== "string" || !bucket.trim()) {
      throw new StorageConfigurationError("Object storage bucket is required")
    }
    if (!providerClient) {
      throw new StorageConfigurationError("Object storage provider client is required")
    }
    this.bucket = bucket.trim()
    this.providerClient = providerClient
  }

  async upload({
    key,
    body,
    contentType,
    contentLength,
    checksum,
    overwrite = false,
  }) {
    const normalizedKey = normalizeStorageKey(key)

    try {
      if (!overwrite && await this.exists(normalizedKey)) {
        throw new StorageConflictError()
      }

      const result = await this.providerClient.putObject({
        bucket: this.bucket,
        key: normalizedKey,
        body,
        contentType,
        contentLength,
        checksum,
      })

      return {
        key: normalizedKey,
        contentType: contentType || "application/octet-stream",
        contentLength: contentLength ?? null,
        checksum: checksum || null,
        etag: result?.etag || null,
      }
    } catch (error) {
      throw objectStorageFailure(error, "write")
    }
  }

  async read(key) {
    const normalizedKey = normalizeStorageKey(key)

    try {
      const result = await this.providerClient.getObject({
        bucket: this.bucket,
        key: normalizedKey,
      })

      return {
        key: normalizedKey,
        stream: protectedStream(result.body),
        contentType: result.contentType || "application/octet-stream",
        contentLength: result.contentLength ?? null,
        checksum: result.checksum || null,
        etag: result.etag || null,
      }
    } catch (error) {
      throw objectStorageFailure(error, "read")
    }
  }

  async exists(key) {
    const normalizedKey = normalizeStorageKey(key)

    try {
      await this.providerClient.headObject({
        bucket: this.bucket,
        key: normalizedKey,
      })
      return true
    } catch (error) {
      if (isNotFoundError(error)) return false
      throw objectStorageFailure(error, "inspect")
    }
  }

  async delete(key) {
    const normalizedKey = normalizeStorageKey(key)

    try {
      await this.providerClient.deleteObject({
        bucket: this.bucket,
        key: normalizedKey,
      })
    } catch (error) {
      if (isNotFoundError(error)) return
      throw objectStorageFailure(error, "delete")
    }
  }
}

module.exports = ObjectStorageAdapter
module.exports.createObjectStorageProviderClient = createObjectStorageProviderClient
