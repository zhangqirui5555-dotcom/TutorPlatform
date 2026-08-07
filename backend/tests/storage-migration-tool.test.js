const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { Readable } = require("node:stream")
const { test } = require("node:test")

const StorageAdapter = require("../src/storage/storageAdapter")
const {
  StorageConflictError,
  StorageNotFoundError,
} = require("../src/storage/storageErrors")
const {
  assertMigrationExecution,
  parseArguments,
} = require("../src/tools/storage-migration/cli")
const { CheckpointStore } = require("../src/tools/storage-migration/checkpoint")
const { inventoryCertifications } = require("../src/tools/storage-migration/inventory")
const {
  ManifestStore,
  MIGRATION_STATUSES,
} = require("../src/tools/storage-migration/manifest")
const {
  MigrationInterruptedError,
  migrateCertifications,
} = require("../src/tools/storage-migration/migrate")
const { buildReport, writeReport } = require("../src/tools/storage-migration/report")
const { verifyMigration } = require("../src/tools/storage-migration/verify")

const FIXED_TIME = new Date("2026-08-08T08:00:00.000Z")
const clock = () => FIXED_TIME

async function createStores(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tutor-migration-"))
  t.after(async () => fs.rm(directory, { force: true, recursive: true }))
  return {
    manifestStore: new ManifestStore(path.join(directory, "manifest.json"), { clock }),
    checkpointStore: new CheckpointStore(path.join(directory, "checkpoint.json"), { clock }),
  }
}

class FakeAdapter extends StorageAdapter {
  constructor(initialObjects = {}) {
    super()
    this.objects = new Map()
    this.calls = { delete: 0, exists: 0, read: 0, upload: 0 }
    this.uploadFailures = []
    for (const [key, value] of Object.entries(initialObjects)) {
      this.objects.set(key, {
        body: Buffer.from(value.body ?? value),
        contentType: value.contentType || "application/pdf",
      })
    }
  }

  async upload(input) {
    this.calls.upload += 1
    if (this.uploadFailures.length) throw this.uploadFailures.shift()
    if (!input.overwrite && this.objects.has(input.key)) throw new StorageConflictError()
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
    })
    return {
      key: input.key,
      contentLength: input.contentLength,
      contentType: input.contentType,
      checksum: input.checksum,
    }
  }

  async read(key) {
    this.calls.read += 1
    const object = this.objects.get(key)
    if (!object) throw new StorageNotFoundError()
    return {
      key,
      stream: Readable.from([object.body]),
      contentLength: object.body.length,
      contentType: object.contentType,
    }
  }

  async exists(key) {
    this.calls.exists += 1
    return this.objects.has(key)
  }

  async delete(key) {
    this.calls.delete += 1
    this.objects.delete(key)
  }
}

function certification(id, overrides = {}) {
  return {
    id,
    studentId: 100 + id,
    materialPath: `uploads/certifications/${100 + id}/material-${id}.pdf`,
    materialType: "STUDENT_CERTIFICATE",
    status: "PENDING",
    ...overrides,
  }
}

function migrationOptions(certifications, sourceAdapter, destinationAdapter, stores, extra = {}) {
  return {
    certifications,
    sourceAdapter,
    destinationAdapter,
    ...stores,
    clock,
    retryOptions: {
      baseDelayMs: 0,
      sleep: async () => {},
      random: () => 0,
    },
    ...extra,
  }
}

test("inventory is read-only and reports statuses, invalid paths, duplicates, and missing files", async () => {
  const records = [
    certification(1),
    certification(2, { status: "APPROVED", materialPath: certification(1).materialPath }),
    certification(3, { status: "REJECTED" }),
    certification(4, { materialPath: "../outside.pdf" }),
  ]
  const sourceAdapter = new FakeAdapter({
    [records[0].materialPath]: "shared material",
  })
  let listCalls = 0
  const certificationRepository = {
    async listCertifications() {
      listCalls += 1
      return records
    },
    async update() {
      throw new Error("inventory must never write")
    },
  }

  const inventory = await inventoryCertifications({
    certificationRepository,
    sourceAdapter,
  })

  assert.equal(listCalls, 1)
  assert.deepEqual(inventory.summary.statusCounts, {
    PENDING: 2,
    APPROVED: 1,
    REJECTED: 1,
  })
  assert.equal(inventory.summary.invalidPaths, 1)
  assert.equal(inventory.summary.duplicateKeys, 1)
  assert.equal(inventory.summary.duplicateRecords, 2)
  assert.equal(inventory.summary.sourceMissing, 1)
})

test("migrate copies and verifies a file and writes the required manifest fields", async (t) => {
  const stores = await createStores(t)
  const record = certification(10)
  const source = new FakeAdapter({ [record.materialPath]: "certification material" })
  const destination = new FakeAdapter()

  const [result] = await migrateCertifications(
    migrationOptions([record], source, destination, stores),
  )

  assert.equal(result.status, MIGRATION_STATUSES.MIGRATED)
  assert.equal(result.sourceSize, Buffer.byteLength("certification material"))
  assert.equal(result.sourceSha256, result.destinationSha256)
  assert.equal(result.verifiedAt, FIXED_TIME.toISOString())
  assert.equal(destination.calls.upload, 1)
  assert.equal(await stores.checkpointStore.has(record.id), true)
  assert.deepEqual(await stores.manifestStore.find(record.id), result)
})

test("resume skips an already verified certification without touching storage", async (t) => {
  const stores = await createStores(t)
  const record = certification(11)
  const source = new FakeAdapter({ [record.materialPath]: "resume material" })
  const destination = new FakeAdapter()
  const options = migrationOptions([record], source, destination, stores)

  const [first] = await migrateCertifications(options)
  const callsAfterFirstRun = { ...destination.calls }
  const [resumed] = await migrateCertifications({ ...options, resume: true })

  assert.deepEqual(resumed, first)
  assert.deepEqual(destination.calls, callsAfterFirstRun)
})

test("dry-run reports planned migration without uploading or writing state", async () => {
  const record = certification(12)
  const source = new FakeAdapter({ [record.materialPath]: "dry run material" })
  const destination = new FakeAdapter()

  const [result] = await migrateCertifications({
    certifications: [record],
    sourceAdapter: source,
    destinationAdapter: destination,
    dryRun: true,
    clock,
  })

  assert.equal(result.status, MIGRATION_STATUSES.WOULD_MIGRATE)
  assert.equal(destination.calls.upload, 0)
  assert.equal(destination.objects.size, 0)
})

test("missing source and destination hash conflict are recorded without upload", async (t) => {
  const stores = await createStores(t)
  const missing = certification(13)
  const conflicting = certification(14)
  const source = new FakeAdapter({ [conflicting.materialPath]: "source bytes" })
  const destination = new FakeAdapter({ [conflicting.materialPath]: "different bytes" })

  const results = await migrateCertifications(
    migrationOptions([missing, conflicting], source, destination, stores),
  )

  assert.deepEqual(results.map((entry) => entry.status), [
    MIGRATION_STATUSES.SOURCE_MISSING,
    MIGRATION_STATUSES.HASH_CONFLICT,
  ])
  assert.equal(destination.calls.upload, 0)
  assert.equal(await stores.checkpointStore.has(missing.id), false)
  assert.equal(await stores.checkpointStore.has(conflicting.id), false)
})

test("retryable upload failures use bounded retries and can recover", async (t) => {
  const stores = await createStores(t)
  const record = certification(15)
  const source = new FakeAdapter({ [record.materialPath]: "retry material" })
  const destination = new FakeAdapter()
  destination.uploadFailures.push(
    Object.assign(new Error("temporary one"), { statusCode: 500 }),
    Object.assign(new Error("temporary two"), { code: "ETIMEDOUT" }),
  )

  const [result] = await migrateCertifications(
    migrationOptions([record], source, destination, stores),
  )

  assert.equal(result.status, MIGRATION_STATUSES.MIGRATED)
  assert.equal(result.attempts, 3)
  assert.equal(destination.calls.upload, 3)
})

test("403 and exhausted upload failures become FAILED without leaking raw messages", async (t) => {
  const firstStores = await createStores(t)
  const forbidden = certification(16)
  const forbiddenSource = new FakeAdapter({ [forbidden.materialPath]: "forbidden" })
  const forbiddenDestination = new FakeAdapter()
  forbiddenDestination.uploadFailures.push(
    Object.assign(new Error("secret provider response"), { statusCode: 403 }),
  )

  const [forbiddenResult] = await migrateCertifications(
    migrationOptions([forbidden], forbiddenSource, forbiddenDestination, firstStores),
  )
  assert.equal(forbiddenResult.status, MIGRATION_STATUSES.FAILED)
  assert.equal(forbiddenDestination.calls.upload, 1)
  assert.equal(JSON.stringify(forbiddenResult).includes("secret provider response"), false)

  const secondStores = await createStores(t)
  const exhausted = certification(17)
  const exhaustedSource = new FakeAdapter({ [exhausted.materialPath]: "exhausted" })
  const exhaustedDestination = new FakeAdapter()
  exhaustedDestination.uploadFailures.push(
    ...Array.from({ length: 5 }, () => Object.assign(new Error("down"), { statusCode: 503 })),
  )
  const [exhaustedResult] = await migrateCertifications(
    migrationOptions([exhausted], exhaustedSource, exhaustedDestination, secondStores),
  )
  assert.equal(exhaustedResult.status, MIGRATION_STATUSES.FAILED)
  assert.equal(exhaustedDestination.calls.upload, 5)
})

test("an interrupted run resumes from its durable manifest and checkpoint", async (t) => {
  const stores = await createStores(t)
  const records = [certification(18), certification(19)]
  const source = new FakeAdapter({
    [records[0].materialPath]: "first material",
    [records[1].materialPath]: "second material",
  })
  const destination = new FakeAdapter()
  const abortController = new AbortController()

  await assert.rejects(
    migrateCertifications(migrationOptions(records, source, destination, stores, {
      signal: abortController.signal,
      onProgress() {
        abortController.abort()
      },
    })),
    (error) => error instanceof MigrationInterruptedError,
  )
  assert.equal((await stores.manifestStore.entries()).length, 1)

  const resumed = await migrateCertifications(
    migrationOptions(records, source, destination, stores, { resume: true }),
  )
  assert.equal(resumed.length, 2)
  assert.equal(destination.calls.upload, 2)
  assert.equal((await stores.manifestStore.entries()).length, 2)
})

test("verify detects destination absence and content changes", async (t) => {
  const stores = await createStores(t)
  const records = [certification(20), certification(21)]
  const source = new FakeAdapter({
    [records[0].materialPath]: "stable material",
    [records[1].materialPath]: "changing material",
  })
  const destination = new FakeAdapter()
  const migrated = await migrateCertifications(
    migrationOptions(records, source, destination, stores),
  )

  destination.objects.delete(records[0].materialPath)
  destination.objects.set(records[1].materialPath, {
    body: Buffer.from("changed after migration"),
    contentType: "application/pdf",
  })
  const verified = await verifyMigration({
    entries: migrated,
    destinationAdapter: destination,
    manifestStore: stores.manifestStore,
    clock,
  })

  assert.equal(verified[0].status, MIGRATION_STATUSES.FAILED)
  assert.equal(verified[0].errorCode, "DESTINATION_MISSING")
  assert.equal(verified[1].status, MIGRATION_STATUSES.HASH_CONFLICT)
})

test("report and manifest whitelist exclude secrets and user privacy fields", async (t) => {
  const stores = await createStores(t)
  const unsafe = {
    certificationId: 22,
    studentId: 122,
    materialPath: "uploads/certifications/122/material.pdf",
    certificationStatus: "APPROVED",
    sourceSize: 8,
    sourceSha256: "source-hash",
    destinationSize: 8,
    destinationSha256: "source-hash",
    status: MIGRATION_STATUSES.MIGRATED,
    attempts: 1,
    verifiedAt: FIXED_TIME.toISOString(),
    secret: "do-not-record-secret",
    token: "do-not-record-token",
    email: "private@example.test",
    password: "do-not-record-password",
  }
  await stores.manifestStore.upsert(unsafe)

  const report = buildReport(await stores.manifestStore.entries(), { clock })
  const reportPath = path.join(path.dirname(stores.manifestStore.filePath), "report.json")
  await writeReport(reportPath, report)
  const parsedReport = JSON.parse(await fs.readFile(reportPath, "utf8"))
  const serialized = JSON.stringify(report)
  assert.equal(report.summary.statusCounts.MIGRATED, 1)
  assert.deepEqual(parsedReport, report)
  assert.equal(serialized.includes("do-not-record"), false)
  assert.equal(serialized.includes("private@example.test"), false)
})

test("CLI parser requires an explicit migration mode and protects production", () => {
  assert.deepEqual(
    parseArguments(["migrate", "--dry-run", "--resume"]),
    { command: "migrate", options: { "dry-run": true, resume: true } },
  )
  assert.throws(() => assertMigrationExecution({}), /explicit/)
  assert.throws(
    () => assertMigrationExecution({ execute: true }, { NODE_ENV: "production" }),
    /allow-production/,
  )
  assert.throws(
    () => assertMigrationExecution(
      { execute: true },
      { RAILWAY_ENVIRONMENT_NAME: "production" },
    ),
    /allow-production/,
  )
  assert.doesNotThrow(
    () => assertMigrationExecution(
      { execute: true, "allow-production": true },
      { NODE_ENV: "production" },
    ),
  )
})
