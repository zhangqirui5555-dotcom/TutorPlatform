const { atomicWriteJson, MIGRATION_STATUSES, sanitizeManifestEntry } = require("./manifest")

function buildReport(entries, {
  inventory = null,
  clock = () => new Date(),
  dryRun = false,
} = {}) {
  const statusCounts = Object.fromEntries(
    Object.values(MIGRATION_STATUSES).map((status) => [status, 0]),
  )
  const certificationStatusCounts = {}
  const sanitizedEntries = entries.map(sanitizeManifestEntry)

  for (const entry of sanitizedEntries) {
    statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1
    certificationStatusCounts[entry.certificationStatus] = (
      certificationStatusCounts[entry.certificationStatus] || 0
    ) + 1
  }

  return {
    version: 1,
    generatedAt: clock().toISOString(),
    dryRun,
    summary: {
      total: sanitizedEntries.length,
      statusCounts,
      certificationStatusCounts,
      inventory: inventory?.summary || null,
    },
    entries: sanitizedEntries,
  }
}

async function writeReport(filePath, report) {
  await atomicWriteJson(filePath, report)
  return report
}

module.exports = {
  buildReport,
  writeReport,
}
