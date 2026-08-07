import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatNotificationTime,
  notificationCategory,
  notificationDisplay,
  notificationTarget,
} from '../src/utils/notificationFormat.js'

const DISPLAY_CASES = [
  ['APPLICATION_RECEIVED', 'PARENT', '收到新的家教申请', '申请通知'],
  ['APPLICATION_ACCEPTED', 'STUDENT', '你的家教申请已通过', '申请通知'],
  ['APPLICATION_REJECTED', 'STUDENT', '本次家教申请未通过', '申请通知'],
  ['ORDER_CONFIRMED', 'STUDENT', '家长已确认订单条款', '订单通知'],
  ['ORDER_IN_PROGRESS', 'PARENT', '学生已确认订单', '订单通知'],
  ['ORDER_IN_PROGRESS', 'STUDENT', '订单已进入服务阶段', '订单通知'],
  ['ORDER_COMPLETED', 'PARENT', '订单已完成', '订单通知'],
  ['ORDER_CANCELLED', 'STUDENT', '订单已取消', '订单通知'],
  ['TRIAL_LESSON_PROPOSED', 'PARENT', '收到新的试课安排', '试课通知'],
  ['TRIAL_LESSON_CONFIRMED', 'STUDENT', '试课安排已确认', '试课通知'],
  ['TRIAL_LESSON_CANCELLED', 'PARENT', '试课已取消', '试课通知'],
  ['TRIAL_LESSON_COMPLETED', 'STUDENT', '试课已完成', '试课通知'],
  ['MESSAGE_RECEIVED', 'PARENT', '你有一条新消息', '消息通知'],
]

test('13 event and role display scenarios use product Chinese copy', () => {
  for (const [type, role, title, category] of DISPLAY_CASES) {
    const display = notificationDisplay({
      type,
      title: type,
      body: JSON.stringify({ internal_status: type }),
      payload: {},
    }, role)

    assert.equal(display.title, title)
    assert.equal(notificationCategory(type), category)
    assert.ok(!display.title.includes(type))
    assert.ok(!display.body.includes(type))
    assert.ok(!display.body.includes('undefined'))
    assert.ok(!display.body.includes('null'))
    assert.ok(!display.body.includes('{'))
  }
})

test('cancellation reasons are compact, optional and never expose null values', () => {
  const longReason = `  时间调整\n${'课程安排变化'.repeat(20)}  `
  const order = notificationDisplay({
    type: 'ORDER_CANCELLED',
    payload: { cancellation_reason: longReason },
  }, 'PARENT')
  const trial = notificationDisplay({
    type: 'TRIAL_LESSON_CANCELLED',
    payload: { cancellation_reason: null },
  }, 'STUDENT')

  assert.match(order.body, /^订单已取消。原因：时间调整 /)
  assert.ok(order.body.endsWith('…'))
  assert.ok(!order.body.includes('\n'))
  assert.equal(trial.body, '本次试课安排已取消。')
})

test('message copy never includes private message content', () => {
  const privateMessage = '这是不应出现在通知列表里的私人聊天正文'
  const display = notificationDisplay({
    type: 'MESSAGE_RECEIVED',
    title: 'New message',
    body: privateMessage,
    payload: { content: privateMessage },
  }, 'PARENT')

  assert.equal(display.title, '你有一条新消息')
  assert.equal(display.body, '对方给你发送了新消息，点击查看。')
  assert.ok(!display.body.includes(privateMessage))
})

test('targets match the next step described by each notification', () => {
  assert.equal(notificationTarget({
    type: 'APPLICATION_RECEIVED',
    payload: { demand_id: 21 },
  }, 'PARENT'), '/parent/demands/21/applications')
  assert.equal(notificationTarget({
    type: 'APPLICATION_ACCEPTED',
    payload: { order_id: 31 },
  }, 'STUDENT'), '/student/orders/31')
  assert.equal(notificationTarget({
    type: 'ORDER_CONFIRMED',
    resource_type: 'ORDER',
    resource_id: 31,
    payload: {},
  }, 'STUDENT'), '/student/orders/31')
  assert.equal(notificationTarget({
    type: 'TRIAL_LESSON_PROPOSED',
    resource_id: 41,
    payload: {},
  }, 'PARENT'), '/parent/trial-lessons?trial_lesson_id=41')
  assert.equal(notificationTarget({
    type: 'MESSAGE_RECEIVED',
    resource_id: 51,
    payload: {},
  }, 'STUDENT'), '/student/messages?conversation_id=51')
})

test('empty or invalid payloads degrade safely', () => {
  for (const payload of [undefined, null, [], 'raw-json']) {
    const display = notificationDisplay({
      type: 'ORDER_CANCELLED',
      payload,
    }, 'PARENT')

    assert.equal(display.body, '该家教订单已取消，请查看订单详情。')
  }

  assert.equal(notificationTarget({
    type: 'APPLICATION_ACCEPTED',
    payload: null,
  }, 'STUDENT'), '/student/applications')
})

test('relative time labels remain unchanged', () => {
  const now = new Date('2026-08-07T12:00:00+08:00')
  assert.equal(formatNotificationTime(now, now), '刚刚')
  assert.equal(formatNotificationTime(new Date(now - 2 * 60000), now), '2分钟前')
  assert.equal(formatNotificationTime(new Date(now - 2 * 3600000), now), '2小时前')
  assert.match(formatNotificationTime(new Date('2026-08-07T05:00:00+08:00'), now), /^今天 /)
  assert.match(formatNotificationTime(new Date('2026-08-06T12:00:00+08:00'), now), /^昨天 /)
})
