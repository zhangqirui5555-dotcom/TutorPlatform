const crypto = require("node:crypto")

async function readStreamWithHash(stream, { maxBytes = 10 * 1024 * 1024 } = {}) {
  const chunks = []
  const hash = crypto.createHash("sha256")
  let size = 0

  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) {
      const error = new Error(`Migration file exceeds ${maxBytes} bytes`)
      error.code = "MIGRATION_FILE_TOO_LARGE"
      throw error
    }
    chunks.push(buffer)
    hash.update(buffer)
  }

  return {
    body: Buffer.concat(chunks),
    sha256: hash.digest("hex"),
    size,
  }
}

module.exports = { readStreamWithHash }
