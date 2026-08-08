const assert = require('node:assert/strict')
const test = require('node:test')

test('review rejects a legacy completed record before its scheduled end', async (t) => {
  const prismaPath = require.resolve('../src/prisma/client')
  const reviewServicePath = require.resolve('../src/services/reviewService')
  const originalPrismaModule = require.cache[prismaPath]
  const originalReviewServiceModule = require.cache[reviewServicePath]
  let createCalls = 0

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      trialLesson: {
        findUnique: async () => ({
          id: 50,
          parentId: 10,
          studentId: 20,
          status: 'COMPLETED',
          scheduledEndAt: new Date('2026-08-08T02:00:00.000Z'),
        }),
      },
      review: {
        create: async () => {
          createCalls += 1
          throw new Error('review creation must not be reached')
        },
      },
    },
  }
  delete require.cache[reviewServicePath]

  t.after(() => {
    if (originalPrismaModule) require.cache[prismaPath] = originalPrismaModule
    else delete require.cache[prismaPath]

    if (originalReviewServiceModule) require.cache[reviewServicePath] = originalReviewServiceModule
    else delete require.cache[reviewServicePath]
  })
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-08-08T01:59:59.999Z'),
  })

  const reviewService = require(reviewServicePath)

  await assert.rejects(
    () => reviewService.submitReview(10, 50, { rating: 5, content: '测试评价' }),
    (error) => {
      assert.equal(error.statusCode, 409)
      assert.equal(error.code, 'TRIAL_LESSON_NOT_ENDED')
      return true
    },
  )
  assert.equal(createCalls, 0)
})
