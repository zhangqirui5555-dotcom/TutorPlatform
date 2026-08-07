import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ORDER_STATUS,
  formatMoney,
  formatPlatformFee,
  orderTimelineItems,
  trialCompletionGuidance,
  yuanInputToCents,
} from '../src/utils/orderFormat.js'
import { resolveTrialLessonTarget } from '../src/utils/trialLessonFocus.js'

test('service amount stays in yuan for users and submits integer cents', () => {
  assert.equal(yuanInputToCents('3000'), 300000)
  assert.equal(yuanInputToCents('3000.50'), 300050)
  assert.equal(formatMoney(300000, 'CNY'), '¥3,000.00')
  assert.equal(yuanInputToCents('3000.001'), null)
})

test('platform fee has an honest null state and never invents a rate', () => {
  assert.equal(formatPlatformFee(null), '暂未确定')
  assert.equal(formatPlatformFee(0), '¥0.00')
  assert.equal(formatPlatformFee(12000), '¥120.00')
})

test('student confirmation and in-progress status use service language', () => {
  assert.match(ORDER_STATUS.CONFIRMED.description, /等待学生确认订单/)
  assert.match(ORDER_STATUS.IN_PROGRESS.description, /沟通并安排试课/)
  assert.ok(!ORDER_STATUS.PENDING.description.includes('支付'))
})

test('trial states control order completion guidance using real records', () => {
  assert.deepEqual(trialCompletionGuidance([]), {
    canComplete: false,
    message: '至少完成一次试课后，才能确认本次订单完成。',
  })
  assert.match(
    trialCompletionGuidance([{ status: 'PENDING_CONFIRMATION' }]).message,
    /等待确认/,
  )
  assert.match(trialCompletionGuidance([{ status: 'CONFIRMED' }]).message, /先完成/)
  assert.equal(
    trialCompletionGuidance([{ status: 'COMPLETED' }]).canComplete,
    true,
  )
})

test('timeline contains only real timestamps with product Chinese labels', () => {
  assert.deepEqual(orderTimelineItems({
    status: 'IN_PROGRESS',
    created_at: '2026-08-01T00:00:00.000Z',
    confirmed_at: '2026-08-02T00:00:00.000Z',
    started_at: '2026-08-03T00:00:00.000Z',
    completed_at: null,
  }).map((item) => item.label), [
    '匹配成功',
    '家长确认金额',
    '学生确认并开始服务',
  ])
})

test('trial lesson query target only resolves to an accessible loaded record', () => {
  const trials = [{ id: 15 }, { id: 16 }]
  assert.equal(resolveTrialLessonTarget('16', trials), 16)
  assert.equal(resolveTrialLessonTarget('99', trials), null)
  assert.equal(resolveTrialLessonTarget('invalid', trials), null)
  assert.equal(resolveTrialLessonTarget(undefined, trials), null)
})

test('order UI avoids payment claims and includes required confirmations', async () => {
  const files = await Promise.all([
    readFile(new URL('../src/components/OrderActionDialog.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/OrderDetailPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/OrderCard.jsx', import.meta.url), 'utf8'),
  ])
  const source = files.join('\n')

  assert.match(source, /确认服务金额/)
  assert.match(source, /不会在此页面扣款/)
  assert.match(source, /确认完成订单？/)
  assert.match(source, /进入评价阶段/)
  assert.match(source, /评价学生 \/ 查看评价/)
  assert.doesNotMatch(source, /已支付|待付款|余额|退款|到账|提现/)
})
