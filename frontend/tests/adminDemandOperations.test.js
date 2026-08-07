import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adminDemandErrorMessage,
  adminDemandOperationAvailability,
  adminDemandPublicStatusLabel,
  adminDemandStatusLabel,
  isAdminDemandEffectivelyFeatured,
  isAdminDemandPubliclyVisible,
} from '../src/utils/adminDemandOperations.js'

test('RECRUITING and HIDDEN demand shows listing but not feature controls', () => {
  assert.deepEqual(adminDemandOperationAvailability({
    status: 'RECRUITING',
    visibility_status: 'HIDDEN',
    is_featured: false,
  }), {
    canList: true,
    canUnlist: false,
    canFeature: false,
    canUnfeature: false,
    canAdjustExpiry: true,
  })
  assert.equal(adminDemandPublicStatusLabel({
    status: 'RECRUITING',
    visibility_status: 'HIDDEN',
  }), '已下架')
})

test('RECRUITING and VISIBLE demand shows unlist and its current feature action', () => {
  const unfeatured = adminDemandOperationAvailability({
    status: 'RECRUITING',
    visibility_status: 'VISIBLE',
    is_featured: false,
  })
  assert.equal(unfeatured.canUnlist, true)
  assert.equal(unfeatured.canFeature, true)
  assert.equal(unfeatured.canUnfeature, false)
  assert.equal(adminDemandPublicStatusLabel({
    status: 'RECRUITING',
    visibility_status: 'VISIBLE',
  }), '已上架')

  const featured = adminDemandOperationAvailability({
    status: 'RECRUITING',
    visibility_status: 'VISIBLE',
    is_featured: true,
  })
  assert.equal(featured.canUnlist, true)
  assert.equal(featured.canFeature, false)
  assert.equal(featured.canUnfeature, true)
})

test('MATCHED and COMPLETED override stale visibility and expose no operations', () => {
  for (const status of ['MATCHED', 'COMPLETED']) {
    const demand = {
      status,
      visibility_status: 'VISIBLE',
      is_featured: true,
    }
    assert.deepEqual(adminDemandOperationAvailability(demand), {
      canList: false,
      canUnlist: false,
      canFeature: false,
      canUnfeature: false,
      canAdjustExpiry: false,
    })
    assert.equal(adminDemandPublicStatusLabel(demand), adminDemandStatusLabel(status))
    assert.equal(isAdminDemandPubliclyVisible(demand), false)
    assert.equal(isAdminDemandEffectivelyFeatured(demand), false)
  }
  assert.equal(adminDemandStatusLabel('MATCHED'), '已匹配')
  assert.equal(adminDemandStatusLabel('COMPLETED'), '已完成')
})

test('CANCELLED demand exposes no operational action', () => {
  assert.deepEqual(adminDemandOperationAvailability({
    status: 'CANCELLED',
    visibility_status: 'VISIBLE',
    is_featured: true,
  }), {
    canList: false,
    canUnlist: false,
    canFeature: false,
    canUnfeature: false,
    canAdjustExpiry: false,
  })
  assert.equal(adminDemandStatusLabel('CANCELLED'), '已取消')
  assert.equal(adminDemandPublicStatusLabel({
    status: 'CANCELLED',
    visibility_status: 'VISIBLE',
  }), '已取消')
})

test('non-recruiting listing errors are always presented in Chinese', () => {
  const byCode = {
    response: {
      status: 409,
      data: {
        error: {
          code: 'DEMAND_NOT_LISTABLE',
          message: 'Only RECRUITING demands can be listed',
        },
      },
    },
  }
  assert.equal(
    adminDemandErrorMessage(byCode),
    '当前需求已不处于招募状态，无法执行上架。',
  )
  assert.equal(
    adminDemandErrorMessage({
      response: {
        status: 409,
        data: { message: 'Only RECRUITING demands can be listed' },
      },
    }),
    '当前需求已不处于招募状态，无法执行上架。',
  )
})
