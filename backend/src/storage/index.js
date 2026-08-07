const path = require("node:path")

const LocalStorageAdapter = require("./localStorageAdapter")
const { StorageConfigurationError } = require("./storageErrors")

const OBJECT_CONFIG_FIELDS = {
  OBJECT_STORAGE_PROVIDER: "provider",
  OBJECT_STORAGE_ENDPOINT: "endpoint",
  OBJECT_STORAGE_REGION: "region",
  OBJECT_STORAGE_BUCKET: "bucket",
  OBJECT_STORAGE_ACCESS_KEY_ID: "accessKeyId",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "secretAccessKey",
}
const SUPPORTED_OBJECT_PROVIDERS = new Set(["cos", "oss", "s3", "s3-compatible"])

function objectStorageConfig(environment) {
  const missing = Object.keys(OBJECT_CONFIG_FIELDS).filter(
    (name) => typeof environment[name] !== "string" || !environment[name].trim(),
  )
  if (missing.length) {
    throw new StorageConfigurationError(
      `Missing object storage configuration: ${missing.join(", ")}`,
    )
  }

  const config = Object.fromEntries(
    Object.entries(OBJECT_CONFIG_FIELDS).map(([environmentName, configName]) => [
      configName,
      environment[environmentName].trim(),
    ]),
  )
  config.provider = config.provider.toLowerCase()

  if (!SUPPORTED_OBJECT_PROVIDERS.has(config.provider)) {
    throw new StorageConfigurationError(
      `Unsupported object storage provider: ${config.provider}`,
    )
  }

  let endpoint
  try {
    endpoint = new URL(config.endpoint)
  } catch (error) {
    throw new StorageConfigurationError("Object storage endpoint must be a valid URL", {
      cause: error,
    })
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new StorageConfigurationError(
      "Object storage endpoint must use HTTPS without embedded credentials",
    )
  }

  return config
}

function createStorageAdapter(environment = process.env, dependencies = {}) {
  const driver = (environment.STORAGE_DRIVER || "local").trim().toLowerCase()

  if (driver === "local") {
    return new LocalStorageAdapter({
      rootDirectory: environment.STORAGE_LOCAL_ROOT || path.resolve(__dirname, "..", ".."),
    })
  }

  if (driver === "object") {
    const config = objectStorageConfig(environment)
    const ObjectStorageAdapter = require("./objectStorageAdapter")
    const providerClient = dependencies.objectProviderClient
      || ObjectStorageAdapter.createObjectStorageProviderClient(config)

    return new ObjectStorageAdapter({
      bucket: config.bucket,
      providerClient,
    })
  }

  throw new StorageConfigurationError(`Unsupported storage driver: ${driver}`)
}

let defaultAdapter

function getStorageAdapter() {
  if (!defaultAdapter) defaultAdapter = createStorageAdapter()
  return defaultAdapter
}

module.exports = {
  createStorageAdapter,
  getStorageAdapter,
  objectStorageConfig,
}
