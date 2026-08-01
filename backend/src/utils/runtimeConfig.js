const DEFAULT_DEMAND_EXPIRE_DAYS_FALLBACK = 30

function positiveIntegerEnvironment(name, fallback) {
  const rawValue = process.env[name]
  if (rawValue === undefined || rawValue === "") {
    return fallback
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer`)
  }

  const value = Number(rawValue)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return value
}

const runtimeConfig = Object.freeze({
  defaultDemandExpireDays: positiveIntegerEnvironment(
    "DEFAULT_DEMAND_EXPIRE_DAYS",
    DEFAULT_DEMAND_EXPIRE_DAYS_FALLBACK,
  ),
})

module.exports = runtimeConfig
