const path = require("node:path")

const LocalStorageAdapter = require("../../storage/localStorageAdapter")
const ObjectStorageAdapter = require("../../storage/objectStorageAdapter")
const { objectStorageConfig } = require("../../storage")
const { createPrismaCertificationRepository } = require("./inventory")

function createSourceAdapter(environment = process.env) {
  return new LocalStorageAdapter({
    rootDirectory: environment.STORAGE_LOCAL_ROOT
      || path.resolve(__dirname, "..", "..", ".."),
  })
}

function createDestinationAdapter(environment = process.env) {
  const config = objectStorageConfig(environment)
  return new ObjectStorageAdapter({
    bucket: config.bucket,
    providerClient: ObjectStorageAdapter.createObjectStorageProviderClient(config),
  })
}

function createCertificationRuntime() {
  const prisma = require("../../prisma/client")
  return {
    certificationRepository: createPrismaCertificationRepository(prisma),
    async disconnect() {
      await prisma.$disconnect()
    },
  }
}

module.exports = {
  createCertificationRuntime,
  createDestinationAdapter,
  createSourceAdapter,
}
