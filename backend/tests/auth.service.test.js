const assert = require('node:assert/strict')
const test = require('node:test')

test('duplicate registration returns the stable EMAIL_ALREADY_EXISTS conflict', async (t) => {
  const prismaPath = require.resolve('../src/prisma/client')
  const authServicePath = require.resolve('../src/services/authService')
  const originalPrismaModule = require.cache[prismaPath]
  const originalAuthServiceModule = require.cache[authServicePath]

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      user: {
        findUnique: async () => ({ id: 1 }),
      },
    },
  }
  delete require.cache[authServicePath]

  t.after(() => {
    if (originalPrismaModule) require.cache[prismaPath] = originalPrismaModule
    else delete require.cache[prismaPath]

    if (originalAuthServiceModule) require.cache[authServicePath] = originalAuthServiceModule
    else delete require.cache[authServicePath]
  })

  const authService = require(authServicePath)

  await assert.rejects(
    () => authService.register({
      email: 'registered@example.com',
      password: 'Test123456!',
      display_name: 'Registered user',
      role: 'PARENT',
    }),
    (error) => {
      assert.equal(error.statusCode, 409)
      assert.equal(error.code, 'EMAIL_ALREADY_EXISTS')
      return true
    },
  )
})
