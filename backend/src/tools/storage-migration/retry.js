const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "ETIMEDOUT",
  "REQUEST_TIMEOUT",
  "TIMEOUT",
])

function errorChain(error) {
  const chain = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }
  return chain
}

function statusOf(error) {
  return error?.$metadata?.httpStatusCode || error?.statusCode || error?.status
}

function isRetryableMigrationError(error) {
  const chain = errorChain(error)
  if (chain.some((item) => statusOf(item) === 403)) return false
  if (chain.some((item) => statusOf(item) === 429)) return true
  if (chain.some((item) => statusOf(item) >= 500)) return true
  return chain.some((item) => NETWORK_ERROR_CODES.has(item?.code))
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function withRetry(operation, {
  maxAttempts = 5,
  baseDelayMs = 100,
  sleep = wait,
  random = Math.random,
  onAttempt,
} = {}) {
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    onAttempt?.(attempt)
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !isRetryableMigrationError(error)) throw error
      const jitter = 0.5 + random()
      await sleep(Math.round(baseDelayMs * (2 ** (attempt - 1)) * jitter))
    }
  }

  throw lastError
}

module.exports = {
  isRetryableMigrationError,
  withRetry,
}
