const fs = require("node:fs/promises")
const path = require("node:path")

const MANIFEST_VERSION = 1
const MIGRATION_STATUSES = Object.freeze({
  MIGRATED: "MIGRATED",
  ALREADY_EXISTS_AND_MATCHED: "ALREADY_EXISTS_AND_MATCHED",
  SOURCE_MISSING: "SOURCE_MISSING",
  HASH_CONFLICT: "HASH_CONFLICT",
  FAILED: "FAILED",
  WOULD_MIGRATE: "WOULD_MIGRATE",
})
const ALLOWED_FIELDS = new Set([
  "certificationId",
  "studentId",
  "materialPath",
  "certificationStatus",
  "sourceSize",
  "sourceSha256",
  "destinationSize",
  "destinationSha256",
  "status",
  "attempts",
  "verifiedAt",
  "errorCode",
  "updatedAt",
])

function sanitizeManifestEntry(entry) {
  const sanitized = {}
  for (const [key, value] of Object.entries(entry || {})) {
    if (ALLOWED_FIELDS.has(key)) sanitized[key] = value
  }
  return sanitized
}

function emptyManifest(clock = () => new Date()) {
  const timestamp = clock().toISOString()
  return {
    version: MANIFEST_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    entries: [],
  }
}

async function atomicWriteJson(filePath, value, fsModule = fs) {
  const directory = path.dirname(path.resolve(filePath))
  await fsModule.mkdir(directory, { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  await fsModule.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w",
  })
  await fsModule.rename(temporaryPath, filePath)
}

class ManifestStore {
  constructor(filePath, { clock = () => new Date(), fsModule = fs } = {}) {
    this.filePath = path.resolve(filePath)
    this.clock = clock
    this.fs = fsModule
    this.cache = null
  }

  async load() {
    if (this.cache) return this.cache
    try {
      const parsed = JSON.parse(await this.fs.readFile(this.filePath, "utf8"))
      if (parsed.version !== MANIFEST_VERSION || !Array.isArray(parsed.entries)) {
        throw new Error("Unsupported migration manifest format")
      }
      parsed.entries = parsed.entries.map(sanitizeManifestEntry)
      this.cache = parsed
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      this.cache = emptyManifest(this.clock)
    }
    return this.cache
  }

  async entries() {
    return [...(await this.load()).entries]
  }

  async find(certificationId) {
    return (await this.load()).entries.find(
      (entry) => entry.certificationId === certificationId,
    ) || null
  }

  async upsert(entry) {
    const manifest = await this.load()
    const sanitized = sanitizeManifestEntry({
      ...entry,
      updatedAt: this.clock().toISOString(),
    })
    const index = manifest.entries.findIndex(
      (item) => item.certificationId === sanitized.certificationId,
    )
    if (index === -1) manifest.entries.push(sanitized)
    else manifest.entries[index] = sanitized
    manifest.updatedAt = this.clock().toISOString()
    await atomicWriteJson(this.filePath, manifest, this.fs)
    return sanitized
  }
}

module.exports = {
  ALLOWED_FIELDS,
  MANIFEST_VERSION,
  MIGRATION_STATUSES,
  ManifestStore,
  atomicWriteJson,
  sanitizeManifestEntry,
}
