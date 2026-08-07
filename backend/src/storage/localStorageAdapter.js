const fsPromises = require("node:fs/promises")
const path = require("node:path")
const { PassThrough } = require("node:stream")

const StorageAdapter = require("./storageAdapter")
const {
  StorageConflictError,
  StorageError,
  StorageNotFoundError,
  StorageUnavailableError,
} = require("./storageErrors")
const { normalizeStorageKey, resolveStoragePath } = require("./storageKey")

const CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
])

function storageFailure(error, action) {
  if (error instanceof StorageError) return error
  if (error?.code === "ENOENT") return new StorageNotFoundError(undefined, { cause: error })
  if (error?.code === "EEXIST") return new StorageConflictError(undefined, { cause: error })
  return new StorageUnavailableError(`Unable to ${action} stored object`, { cause: error })
}

class LocalStorageAdapter extends StorageAdapter {
  constructor({ rootDirectory }) {
    super()
    this.rootDirectory = path.resolve(rootDirectory)
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
    const absolutePath = resolveStoragePath(this.rootDirectory, normalizedKey)

    try {
      await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true })
      await fsPromises.writeFile(absolutePath, body, {
        flag: overwrite ? "w" : "wx",
      })
      const stats = await fsPromises.stat(absolutePath)

      return {
        key: normalizedKey,
        contentType: contentType || this.contentTypeFor(normalizedKey),
        contentLength: contentLength ?? stats.size,
        checksum: checksum || null,
        etag: null,
      }
    } catch (error) {
      throw storageFailure(error, "write")
    }
  }

  async read(key) {
    const normalizedKey = normalizeStorageKey(key)
    const absolutePath = resolveStoragePath(this.rootDirectory, normalizedKey)

    try {
      const handle = await fsPromises.open(absolutePath, "r")
      const stats = await handle.stat()

      if (!stats.isFile()) {
        await handle.close()
        throw new StorageNotFoundError()
      }

      const source = handle.createReadStream()
      const stream = new PassThrough()

      source.on("error", (error) => {
        stream.destroy(storageFailure(error, "read"))
      })
      stream.on("close", () => source.destroy())
      source.pipe(stream)

      return {
        key: normalizedKey,
        stream,
        contentType: this.contentTypeFor(normalizedKey),
        contentLength: stats.size,
        checksum: null,
        etag: null,
      }
    } catch (error) {
      throw storageFailure(error, "read")
    }
  }

  async exists(key) {
    const absolutePath = resolveStoragePath(this.rootDirectory, key)

    try {
      const stats = await fsPromises.stat(absolutePath)
      return stats.isFile()
    } catch (error) {
      if (error?.code === "ENOENT") return false
      throw storageFailure(error, "inspect")
    }
  }

  async delete(key) {
    const absolutePath = resolveStoragePath(this.rootDirectory, key)

    try {
      await fsPromises.rm(absolutePath, { force: true })
    } catch (error) {
      throw storageFailure(error, "delete")
    }
  }

  contentTypeFor(key) {
    return CONTENT_TYPES.get(path.extname(key).toLowerCase()) || "application/octet-stream"
  }
}

module.exports = LocalStorageAdapter
