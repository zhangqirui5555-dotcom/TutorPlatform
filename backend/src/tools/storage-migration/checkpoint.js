const fs = require("node:fs/promises")
const path = require("node:path")

const { atomicWriteJson } = require("./manifest")

class CheckpointStore {
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
      if (!Array.isArray(parsed.completedCertificationIds)) {
        throw new Error("Invalid migration checkpoint format")
      }
      this.cache = parsed
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      this.cache = {
        version: 1,
        completedCertificationIds: [],
        updatedAt: this.clock().toISOString(),
      }
    }
    return this.cache
  }

  async has(certificationId) {
    return (await this.load()).completedCertificationIds.includes(certificationId)
  }

  async markCompleted(certificationId) {
    const checkpoint = await this.load()
    if (!checkpoint.completedCertificationIds.includes(certificationId)) {
      checkpoint.completedCertificationIds.push(certificationId)
      checkpoint.completedCertificationIds.sort((left, right) => left - right)
    }
    checkpoint.updatedAt = this.clock().toISOString()
    await atomicWriteJson(this.filePath, checkpoint, this.fs)
  }
}

module.exports = { CheckpointStore }
