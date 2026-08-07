const assert = require("node:assert/strict")
const { Readable } = require("node:stream")
const { test } = require("node:test")

const ObjectStorageAdapter = require("../src/storage/objectStorageAdapter")
const {
  createStorageAdapter,
  objectStorageConfig,
} = require("../src/storage")
const {
  StorageConfigurationError,
  StorageConflictError,
  StorageNotFoundError,
  StorageUnavailableError,
} = require("../src/storage/storageErrors")

const OBJECT_ENVIRONMENT = {
  STORAGE_DRIVER: "object",
  OBJECT_STORAGE_PROVIDER: "s3-compatible",
  OBJECT_STORAGE_ENDPOINT: "https://objects.example.test",
  OBJECT_STORAGE_REGION: "test-region-1",
  OBJECT_STORAGE_BUCKET: "private-certifications",
  OBJECT_STORAGE_ACCESS_KEY_ID: "test-access-key",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "test-secret-key",
}

function notFoundError() {
  const error = new Error("provider object missing")
  error.name = "NoSuchKey"
  error.$metadata = { httpStatusCode: 404 }
  return error
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

class FakeObjectProviderClient {
  constructor() {
    this.objects = new Map()
    this.calls = []
  }

  async putObject(input) {
    this.calls.push({ operation: "put", input })
    const body = Buffer.from(input.body)
    this.objects.set(input.key, {
      body,
      checksum: input.checksum,
      contentType: input.contentType,
    })
    return { etag: "fake-object-etag" }
  }

  async getObject(input) {
    this.calls.push({ operation: "get", input })
    const object = this.objects.get(input.key)
    if (!object) throw notFoundError()
    return {
      body: Readable.from([object.body]),
      checksum: object.checksum,
      contentLength: object.body.length,
      contentType: object.contentType,
      etag: "fake-object-etag",
    }
  }

  async headObject(input) {
    this.calls.push({ operation: "head", input })
    if (!this.objects.has(input.key)) throw notFoundError()
  }

  async deleteObject(input) {
    this.calls.push({ operation: "delete", input })
    this.objects.delete(input.key)
  }
}

test("ObjectStorageAdapter uploads, streams, checks, and deletes private objects", async () => {
  const providerClient = new FakeObjectProviderClient()
  const adapter = new ObjectStorageAdapter({
    bucket: OBJECT_ENVIRONMENT.OBJECT_STORAGE_BUCKET,
    providerClient,
  })
  const body = Buffer.from("private certification material")
  const key = "uploads/certifications/41/material.pdf"

  const uploaded = await adapter.upload({
    key,
    body,
    contentType: "application/pdf",
    contentLength: body.length,
    checksum: "fake-sha256",
  })

  assert.deepEqual(uploaded, {
    key,
    contentType: "application/pdf",
    contentLength: body.length,
    checksum: "fake-sha256",
    etag: "fake-object-etag",
  })
  assert.equal(await adapter.exists(key), true)

  const material = await adapter.read(key)
  assert.equal(material.key, key)
  assert.equal(material.contentType, "application/pdf")
  assert.equal(material.contentLength, body.length)
  assert.deepEqual(await streamToBuffer(material.stream), body)

  await adapter.delete(key)
  assert.equal(await adapter.exists(key), false)
  await adapter.delete(key)

  assert.equal(JSON.stringify(uploaded).includes("private-certifications"), false)
  assert.equal(JSON.stringify(uploaded).includes("objects.example.test"), false)
  assert.equal(JSON.stringify(uploaded).includes("test-secret-key"), false)
})

test("ObjectStorageAdapter prevents accidental overwrite by default", async () => {
  const providerClient = new FakeObjectProviderClient()
  const adapter = new ObjectStorageAdapter({ bucket: "private", providerClient })
  const key = "uploads/certifications/42/material.png"

  await adapter.upload({ key, body: Buffer.from("first") })
  await assert.rejects(
    adapter.upload({ key, body: Buffer.from("second") }),
    (error) => error instanceof StorageConflictError && error.statusCode === 409,
  )
})

test("ObjectStorageAdapter converts provider request errors", async () => {
  const providerError = Object.assign(new Error("AccessDenied: provider detail"), {
    name: "AccessDenied",
    $metadata: { httpStatusCode: 403 },
  })
  const adapter = new ObjectStorageAdapter({
    bucket: "private",
    providerClient: {
      async headObject() {
        throw notFoundError()
      },
      async putObject() {
        throw providerError
      },
    },
  })

  await assert.rejects(
    adapter.upload({
      key: "uploads/certifications/43/material.jpg",
      body: Buffer.from("material"),
    }),
    (error) => (
      error instanceof StorageUnavailableError
      && error.code === "STORAGE_UNAVAILABLE"
      && error.statusCode === 503
      && error.cause === providerError
      && !error.message.includes("provider detail")
    ),
  )
})

test("ObjectStorageAdapter converts provider stream errors", async () => {
  const providerError = new Error("socket contains provider detail")
  const adapter = new ObjectStorageAdapter({
    bucket: "private",
    providerClient: {
      async getObject() {
        return {
          body: Readable.from((async function* failingStream() {
            yield Buffer.from("partial")
            throw providerError
          })()),
        }
      },
    },
  })

  const material = await adapter.read("uploads/certifications/44/material.jpg")
  await assert.rejects(
    streamToBuffer(material.stream),
    (error) => (
      error instanceof StorageUnavailableError
      && error.cause === providerError
      && !error.message.includes("provider detail")
    ),
  )
})

test("ObjectStorageAdapter maps missing reads and idempotent deletes", async () => {
  const adapter = new ObjectStorageAdapter({
    bucket: "private",
    providerClient: {
      async getObject() {
        throw notFoundError()
      },
      async deleteObject() {
        throw notFoundError()
      },
    },
  })

  await assert.rejects(
    adapter.read("uploads/certifications/45/missing.pdf"),
    (error) => error instanceof StorageNotFoundError && error.statusCode === 404,
  )
  await adapter.delete("uploads/certifications/45/missing.pdf")
})

test("object storage configuration fails for every missing required value", () => {
  for (const name of [
    "OBJECT_STORAGE_PROVIDER",
    "OBJECT_STORAGE_ENDPOINT",
    "OBJECT_STORAGE_REGION",
    "OBJECT_STORAGE_BUCKET",
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    const environment = { ...OBJECT_ENVIRONMENT }
    delete environment[name]

    assert.throws(
      () => objectStorageConfig(environment),
      (error) => (
        error instanceof StorageConfigurationError
        && error.message.includes(name)
      ),
    )
  }
})

test("object storage configuration rejects unsafe endpoints and unknown providers", () => {
  assert.throws(
    () => objectStorageConfig({
      ...OBJECT_ENVIRONMENT,
      OBJECT_STORAGE_ENDPOINT: "http://objects.example.test",
    }),
    (error) => (
      error instanceof StorageConfigurationError
      && error.message.includes("HTTPS")
    ),
  )

  assert.throws(
    () => objectStorageConfig({
      ...OBJECT_ENVIRONMENT,
      OBJECT_STORAGE_PROVIDER: "unknown-provider",
    }),
    (error) => (
      error instanceof StorageConfigurationError
      && error.message.includes("Unsupported")
    ),
  )
})

test("storage factory creates object adapter only with explicit object configuration", () => {
  const providerClient = new FakeObjectProviderClient()
  const adapter = createStorageAdapter(OBJECT_ENVIRONMENT, { objectProviderClient: providerClient })

  assert.ok(adapter instanceof ObjectStorageAdapter)
  assert.equal(adapter.providerClient, providerClient)
  assert.throws(
    () => createStorageAdapter({ STORAGE_DRIVER: "object" }),
    (error) => (
      error instanceof StorageConfigurationError
      && error.message.includes("OBJECT_STORAGE_PROVIDER")
    ),
  )
})

test("provider client uses private S3-compatible commands without an ACL", async () => {
  const commands = []
  const client = {
    async send(command) {
      commands.push(command)
      if (command.constructor.name === "GetObjectCommand") {
        return {
          Body: Readable.from([Buffer.from("material")]),
          ContentLength: 8,
          ContentType: "application/pdf",
          ETag: "provider-etag",
          Metadata: { sha256: "provider-checksum" },
        }
      }
      if (command.constructor.name === "HeadObjectCommand") {
        return { ContentLength: 8, ContentType: "application/pdf" }
      }
      return { ETag: "provider-etag" }
    },
  }
  const providerClient = ObjectStorageAdapter.createObjectStorageProviderClient(
    objectStorageConfig(OBJECT_ENVIRONMENT),
    { client },
  )
  const common = {
    bucket: "private-certifications",
    key: "uploads/certifications/46/material.pdf",
  }

  await providerClient.putObject({
    ...common,
    body: Buffer.from("material"),
    contentLength: 8,
    contentType: "application/pdf",
    checksum: "provider-checksum",
  })
  await providerClient.getObject(common)
  await providerClient.headObject(common)
  await providerClient.deleteObject(common)

  assert.deepEqual(
    commands.map((command) => command.constructor.name),
    ["PutObjectCommand", "GetObjectCommand", "HeadObjectCommand", "DeleteObjectCommand"],
  )
  assert.equal(commands[0].input.ACL, undefined)
  assert.equal(commands[0].input.Bucket, "private-certifications")
  assert.equal(commands[0].input.Key, common.key)
})
