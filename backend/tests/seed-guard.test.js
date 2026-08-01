const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const { test } = require("node:test")

function seedEnvironment(overrides = {}) {
  const environment = { ...process.env }
  delete environment.ALLOW_DEMO_SEED
  delete environment.NODE_ENV
  delete environment.RAILWAY_ENVIRONMENT
  delete environment.RAILWAY_ENVIRONMENT_NAME

  return {
    ...environment,
    DATABASE_URL: "postgresql://localhost/tutorplatform_seed_guard_test",
    DEMO_SEED_PASSWORD: "local-test-password",
    ...overrides,
  }
}

function runSeed(environment) {
  return spawnSync(process.execPath, ["prisma/seed.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment,
  })
}

test("demo seed requires explicit non-production opt-in", () => {
  const result = runSeed(seedEnvironment())

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Set ALLOW_DEMO_SEED=true/)
})

test("demo seed remains disabled in production even with explicit opt-in", () => {
  const result = runSeed(seedEnvironment({
    ALLOW_DEMO_SEED: "true",
    NODE_ENV: "production",
  }))

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Demo seed is disabled in production environments/)
})
