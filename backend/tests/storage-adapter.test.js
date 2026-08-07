const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { Readable } = require("node:stream")
const { test } = require("node:test")

const { createCertificationMaterialService } = require(
  "../src/services/certificationMaterialService",
)
const LocalStorageAdapter = require("../src/storage/localStorageAdapter")
const StorageAdapter = require("../src/storage/storageAdapter")
const {
  StorageNotFoundError,
  StorageUnavailableError,
  StorageValidationError,
} = require("../src/storage/storageErrors")

async function createTemporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tutor-storage-"))
  t.after(async () => {
    await fs.rm(directory, { force: true, recursive: true })
  })
  return directory
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

class FakeStorageAdapter extends StorageAdapter {
  constructor() {
    super()
    this.objects = new Map()
    this.deletedKeys = []
  }

  async upload(input) {
    const body = Buffer.from(input.body)
    this.objects.set(input.key, {
      body,
      contentType: input.contentType,
      checksum: input.checksum,
    })
    return {
      key: input.key,
      contentType: input.contentType,
      contentLength: body.length,
      checksum: input.checksum,
      etag: "fake-etag",
    }
  }

  async read(key) {
    const object = this.objects.get(key)
    if (!object) throw new StorageNotFoundError()
    return {
      key,
      stream: Readable.from([object.body]),
      contentType: object.contentType,
      contentLength: object.body.length,
      checksum: object.checksum,
      etag: "fake-etag",
    }
  }

  async exists(key) {
    return this.objects.has(key)
  }

  async delete(key) {
    this.deletedKeys.push(key)
    this.objects.delete(key)
  }
}

test("LocalStorageAdapter uploads, streams, checks, and deletes files", async (t) => {
  const rootDirectory = await createTemporaryDirectory(t)
  const adapter = new LocalStorageAdapter({ rootDirectory })
  const key = "uploads/certifications/12/material.pdf"
  const body = Buffer.from("local certification")

  const uploaded = await adapter.upload({
    key,
    body,
    contentType: "application/pdf",
    contentLength: body.length,
    checksum: "test-checksum",
  })

  assert.equal(uploaded.key, key)
  assert.equal(uploaded.contentLength, body.length)
  assert.equal(await adapter.exists(key), true)

  const material = await adapter.read(key)
  assert.equal(material.contentType, "application/pdf")
  assert.equal(material.contentLength, body.length)
  assert.deepEqual(await streamToBuffer(material.stream), body)

  await adapter.delete(key)
  assert.equal(await adapter.exists(key), false)
  await adapter.delete(key)
})

test("LocalStorageAdapter converts missing files to storage errors", async (t) => {
  const rootDirectory = await createTemporaryDirectory(t)
  const adapter = new LocalStorageAdapter({ rootDirectory })

  assert.equal(await adapter.exists("uploads/certifications/1/missing.jpg"), false)
  await assert.rejects(
    adapter.read("uploads/certifications/1/missing.jpg"),
    (error) => error instanceof StorageNotFoundError && error.statusCode === 404,
  )
})

test("LocalStorageAdapter rejects every path traversal form", async (t) => {
  const rootDirectory = await createTemporaryDirectory(t)
  const adapter = new LocalStorageAdapter({ rootDirectory })

  for (const key of [
    "../secret.pdf",
    "uploads/../../secret.pdf",
    "uploads\\..\\secret.pdf",
    "/absolute/secret.pdf",
    "C:\\secret.pdf",
  ]) {
    await assert.rejects(
      adapter.upload({ key, body: Buffer.from("blocked") }),
      (error) => error instanceof StorageValidationError,
    )
  }
})

test("LocalStorageAdapter never exposes raw filesystem errors", async (t) => {
  const directory = await createTemporaryDirectory(t)
  const rootFile = path.join(directory, "not-a-directory")
  await fs.writeFile(rootFile, "root file")
  const adapter = new LocalStorageAdapter({ rootDirectory: rootFile })

  await assert.rejects(
    adapter.upload({
      key: "uploads/certifications/1/material.jpg",
      body: Buffer.from("material"),
    }),
    (error) => (
      error instanceof StorageUnavailableError
      && error.code === "STORAGE_UNAVAILABLE"
      && error.cause?.code === "ENOTDIR"
    ),
  )
})

test("Certification material service uploads through an injected adapter", async () => {
  const storageAdapter = new FakeStorageAdapter()
  const submissions = []
  const repository = {
    async submitCertification(studentId, input) {
      submissions.push({ studentId, input })
      return { id: 41, material_path: input.material_path, status: "PENDING" }
    },
  }
  const service = createCertificationMaterialService({
    storageAdapter,
    certificationRepository: repository,
    storagePrefix: "uploads/certifications",
    createId: () => "fixed-id",
  })

  const result = await service.uploadCertification(12, {
    data_base64: Buffer.from("student material").toString("base64"),
    mime_type: "image/png",
  })

  const key = "uploads/certifications/12/fixed-id.png"
  assert.equal(result.id, 41)
  assert.equal(await storageAdapter.exists(key), true)
  assert.deepEqual(submissions, [{
    studentId: 12,
    input: {
      material_path: key,
      material_type: "STUDENT_CERTIFICATE",
    },
  }])
})

test("Certification material service deletes an upload when the database fails", async () => {
  const storageAdapter = new FakeStorageAdapter()
  const databaseError = new Error("database unavailable")
  const service = createCertificationMaterialService({
    storageAdapter,
    certificationRepository: {
      async submitCertification() {
        throw databaseError
      },
    },
    createId: () => "rollback-id",
  })

  await assert.rejects(
    service.uploadCertification(20, {
      data_base64: Buffer.from("rollback material").toString("base64"),
      mime_type: "application/pdf",
    }),
    (error) => error === databaseError,
  )

  const key = "uploads/certifications/20/rollback-id.pdf"
  assert.deepEqual(storageAdapter.deletedKeys, [key])
  assert.equal(await storageAdapter.exists(key), false)
})

test("Certification material service authorizes before streaming storage", async () => {
  const storageAdapter = new FakeStorageAdapter()
  const key = "uploads/certifications/30/read-id.jpg"
  await storageAdapter.upload({
    key,
    body: Buffer.from("readable material"),
    contentType: "image/jpeg",
  })
  const authorizationCalls = []
  const service = createCertificationMaterialService({
    storageAdapter,
    certificationRepository: {
      async getCertificationMaterial(certificationId, studentId) {
        authorizationCalls.push({ certificationId, studentId })
        return { id: certificationId, studentId, materialPath: key }
      },
    },
  })

  const { material } = await service.getCertificationMaterial(91, 30)
  assert.deepEqual(authorizationCalls, [{ certificationId: 91, studentId: 30 }])
  assert.equal(material.contentType, "image/jpeg")
  assert.equal((await streamToBuffer(material.stream)).toString(), "readable material")
})

test("Certification material service preserves missing-object errors", async () => {
  const service = createCertificationMaterialService({
    storageAdapter: new FakeStorageAdapter(),
    certificationRepository: {
      async getCertificationMaterial() {
        return {
          id: 92,
          studentId: 31,
          materialPath: "uploads/certifications/31/missing.png",
        }
      },
    },
  })

  await assert.rejects(
    service.getCertificationMaterial(92, 31),
    (error) => error instanceof StorageNotFoundError,
  )
})
