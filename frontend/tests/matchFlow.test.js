import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applicationResourceMap,
  matchFlowPaths,
  resourcesFromAcceptResult,
} from '../src/utils/matchFlow.js'
import { orderNextStep } from '../src/utils/orderFormat.js'

test('accept response resources produce precise parent destinations', () => {
  const resources = resourcesFromAcceptResult({
    order: { id: 72 },
    conversation: { id: 91 },
  })

  assert.deepEqual(matchFlowPaths(resources, 'PARENT'), {
    order: '/parent/orders/72',
    messages: '/parent/messages?conversation_id=91',
    trials: '/parent/trial-lessons',
  })
})

test('missing and invalid resources safely fall back without fake ids', () => {
  assert.deepEqual(matchFlowPaths({ orderId: 'undefined', conversationId: -4 }), {
    order: '/parent/orders',
    messages: '/parent/messages',
    trials: '/parent/trial-lessons',
  })
  assert.deepEqual(matchFlowPaths({}, 'STUDENT'), {
    order: '/student/orders',
    messages: '/student/messages',
    trials: '/student/trial-lessons',
  })
})

test('accepted applications recover order and conversation links from existing lists', () => {
  const resources = applicationResourceMap(
    [
      { id: 11, status: 'ACCEPTED' },
      { id: 12, status: 'REJECTED' },
    ],
    [{ id: 21, application_id: 11 }],
    [{ id: 31, application_id: 11 }],
  )

  assert.deepEqual(resources, {
    11: { orderId: 21, conversationId: 31 },
  })
  assert.equal(resources[12], undefined)
})

test('order next-step copy explains all current statuses', () => {
  assert.equal(orderNextStep('PENDING'), '家长确认本次家教服务金额')
  assert.equal(orderNextStep('CONFIRMED'), '等待学生确认订单')
  assert.equal(orderNextStep('IN_PROGRESS'), '沟通并完成试课')
  assert.equal(orderNextStep('COMPLETED'), '本次服务已完成')
  assert.equal(orderNextStep('CANCELLED'), '订单已取消')
})
