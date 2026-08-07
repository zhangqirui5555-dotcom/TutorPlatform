#!/usr/bin/env node
require("dotenv").config()

const path = require("node:path")

const { CheckpointStore } = require("./checkpoint")
const { inventoryCertifications } = require("./inventory")
const { ManifestStore, MIGRATION_STATUSES } = require("./manifest")
const { MigrationInterruptedError, migrateCertifications } = require("./migrate")
const { buildReport, writeReport } = require("./report")
const {
  createCertificationRuntime,
  createDestinationAdapter,
  createSourceAdapter,
} = require("./runtime")
const { verifyMigration } = require("./verify")

const VALUE_OPTIONS = new Set(["manifest", "checkpoint", "output"])
const BOOLEAN_OPTIONS = new Set([
  "allow-production",
  "dry-run",
  "execute",
  "resume",
])

function usage() {
  return [
    "Usage:",
    "  node src/tools/storage-migration/cli.js inventory [--output FILE]",
    "  node src/tools/storage-migration/cli.js migrate (--dry-run | --execute) [--resume] [--manifest FILE] [--checkpoint FILE] [--output FILE]",
    "  node src/tools/storage-migration/cli.js verify [--dry-run] [--manifest FILE] [--output FILE]",
    "  node src/tools/storage-migration/cli.js report [--manifest FILE] [--output FILE]",
    "",
    "Production execution additionally requires --allow-production.",
  ].join("\n")
}

function parseArguments(argv) {
  const [command, ...tokens] = argv
  if (!["inventory", "migrate", "verify", "report"].includes(command)) {
    const error = new Error(usage())
    error.code = "INVALID_COMMAND"
    throw error
  }

  const options = {}
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`)
    const name = token.slice(2)
    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] = true
      continue
    }
    if (!VALUE_OPTIONS.has(name)) throw new Error(`Unknown option: --${name}`)
    const value = tokens[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`)
    options[name] = value
    index += 1
  }
  return { command, options }
}

function resolvePaths(options) {
  return {
    manifestPath: path.resolve(
      options.manifest || process.env.STORAGE_MIGRATION_MANIFEST
        || "storage-migration-manifest.json",
    ),
    checkpointPath: path.resolve(
      options.checkpoint || process.env.STORAGE_MIGRATION_CHECKPOINT
        || "storage-migration-checkpoint.json",
    ),
    outputPath: options.output ? path.resolve(options.output) : null,
  }
}

function assertMigrationExecution(options, environment = process.env) {
  if (options["dry-run"] && options.execute) {
    throw new Error("Choose either --dry-run or --execute")
  }
  if (!options["dry-run"] && !options.execute) {
    throw new Error("migrate requires explicit --dry-run or --execute")
  }
  const environmentNames = [
    environment.NODE_ENV,
    environment.RAILWAY_ENVIRONMENT,
    environment.RAILWAY_ENVIRONMENT_NAME,
  ].filter(Boolean).map((value) => String(value).toLowerCase())
  if (options.execute && environmentNames.includes("production")
    && !options["allow-production"]) {
    throw new Error("Production migration requires --allow-production")
  }
}

function hasBlockingResults(report) {
  const counts = report.summary.statusCounts
  return counts[MIGRATION_STATUSES.SOURCE_MISSING]
    || counts[MIGRATION_STATUSES.HASH_CONFLICT]
    || counts[MIGRATION_STATUSES.FAILED]
}

async function emitJson(value, outputPath) {
  if (outputPath) await writeReport(outputPath, value)
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function run(argv = process.argv.slice(2)) {
  const { command, options } = parseArguments(argv)
  const paths = resolvePaths(options)
  const manifestStore = new ManifestStore(paths.manifestPath)

  if (command === "report") {
    const report = buildReport(await manifestStore.entries())
    await emitJson(report, paths.outputPath)
    return 0
  }

  if (command === "verify") {
    const entries = await manifestStore.entries()
    const results = await verifyMigration({
      entries,
      destinationAdapter: createDestinationAdapter(),
      manifestStore,
      dryRun: Boolean(options["dry-run"]),
    })
    const report = buildReport(results, { dryRun: Boolean(options["dry-run"]) })
    await emitJson(report, paths.outputPath)
    return hasBlockingResults(report) ? 2 : 0
  }

  const runtime = createCertificationRuntime()
  try {
    const sourceAdapter = createSourceAdapter()
    const inventory = await inventoryCertifications({
      certificationRepository: runtime.certificationRepository,
      sourceAdapter,
      storagePrefix: process.env.CERTIFICATION_STORAGE_PREFIX,
    })

    if (command === "inventory") {
      const output = {
        generatedAt: inventory.generatedAt,
        summary: inventory.summary,
        duplicateKeys: inventory.duplicateKeys,
        entries: inventory.entries,
      }
      await emitJson(output, paths.outputPath)
      return inventory.summary.invalidPaths
        || inventory.summary.sourceMissing
        || inventory.summary.sourceCheckFailed ? 2 : 0
    }

    assertMigrationExecution(options)
    const dryRun = Boolean(options["dry-run"])
    if (!dryRun && !options.resume && (await manifestStore.entries()).length) {
      throw new Error("Manifest already contains entries; use --resume or a new manifest")
    }

    const checkpointStore = new CheckpointStore(paths.checkpointPath)
    const abortController = new AbortController()
    const interrupt = () => abortController.abort()
    process.once("SIGINT", interrupt)
    try {
      const results = await migrateCertifications({
        certifications: inventory.certifications,
        sourceAdapter,
        destinationAdapter: createDestinationAdapter(),
        manifestStore,
        checkpointStore,
        storagePrefix: process.env.CERTIFICATION_STORAGE_PREFIX,
        resume: Boolean(options.resume),
        dryRun,
        signal: abortController.signal,
      })
      const report = buildReport(results, { inventory, dryRun })
      await emitJson(report, paths.outputPath)
      return hasBlockingResults(report) ? 2 : 0
    } finally {
      process.removeListener("SIGINT", interrupt)
    }
  } finally {
    await runtime.disconnect()
  }
}

function safeCliError(error) {
  if (error instanceof MigrationInterruptedError) {
    return { code: error.code, message: "Migration interrupted; rerun with --resume" }
  }
  const safeCodes = new Set([
    "INVALID_COMMAND",
    "STORAGE_CONFIGURATION_ERROR",
  ])
  return {
    code: safeCodes.has(error?.code) ? error.code : "STORAGE_MIGRATION_FAILED",
    message: safeCodes.has(error?.code) ? error.message : "Storage migration command failed",
  }
}

if (require.main === module) {
  run()
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ error: safeCliError(error) })}\n`)
      process.exitCode = error instanceof MigrationInterruptedError ? 130 : 1
    })
}

module.exports = {
  assertMigrationExecution,
  parseArguments,
  resolvePaths,
  run,
  safeCliError,
}
