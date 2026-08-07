import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildTrialLessonRequest,
  orderTrialLessonPath,
  resolveTrialCreationApplicationId,
  trialCreationContexts,
  trialLessonErrorMessage,
} from '../src/utils/trialLessonCreate.js'

const applications = [
  { id: 11, status: 'ACCEPTED', demand: { title: '初中数学' } },
  { id: 12, status: 'PENDING', demand: { title: '高中物理' } },
  { id: 13, status: 'ACCEPTED', demand: { title: '小学英语' } },
]
const orders = [
  { id: 21, application_id: 11, status: 'IN_PROGRESS' },
  { id: 22, application_id: 12, status: 'PENDING' },
]

test('student creation contexts only use accepted applications with their orders', () => {
  const contexts = trialCreationContexts(applications, orders)
  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].applicationId, 11)
  assert.equal(contexts[0].orderId, 21)
})

test('order route context selects the matching application instead of a stale value', () => {
  const contexts = trialCreationContexts(
    [applications[0], applications[2]],
    [orders[0], { id: 23, application_id: 13 }],
  )
  assert.equal(resolveTrialCreationApplicationId(contexts, {
    applicationId: 13,
    orderId: 23,
    currentApplicationId: 11,
  }), '13')
  assert.equal(resolveTrialCreationApplicationId(contexts, {
    orderId: 21,
    currentApplicationId: 13,
  }), '11')
  assert.equal(resolveTrialCreationApplicationId(contexts, {
    applicationId: 11,
    orderId: 23,
    currentApplicationId: 13,
  }), '13')
})

test('trial request uses application id, ISO times, and never sends order id', () => {
  const contexts = trialCreationContexts(applications, orders)
  const request = buildTrialLessonRequest({
    application_id: '11',
    scheduled_start_at: '2026-08-09T10:00',
    scheduled_end_at: '2026-08-09T11:00',
    method: 'ONLINE',
    location_or_link: '  https://example.test/trial  ',
  }, contexts)

  assert.equal(request.applicationId, 11)
  assert.equal(request.orderId, 21)
  assert.equal(request.payload.scheduled_start_at, new Date('2026-08-09T10:00').toISOString())
  assert.equal(request.payload.scheduled_end_at, new Date('2026-08-09T11:00').toISOString())
  assert.equal(request.payload.location_or_link, 'https://example.test/trial')
  assert.equal('order_id' in request.payload, false)
})

test('invalid context and invalid times are stopped before the API request', () => {
  const contexts = trialCreationContexts(applications, orders)
  assert.throws(() => buildTrialLessonRequest({ application_id: '99' }, contexts), /有效/)
  assert.throws(() => buildTrialLessonRequest({
    application_id: '11',
    scheduled_start_at: 'invalid',
    scheduled_end_at: '2026-08-09T11:00',
    method: 'ONLINE',
  }, contexts), /有效的开始和结束时间/)
  assert.throws(() => buildTrialLessonRequest({
    application_id: '11',
    scheduled_start_at: '2026-08-09T11:00',
    scheduled_end_at: '2026-08-09T10:00',
    method: 'ONLINE',
  }, contexts), /结束时间必须晚于开始时间/)
})

test('backend business message is shown without replacing it with a generic error', () => {
  const error = {
    response: {
      data: { error: { code: 'APPLICATION_NOT_ACCEPTED', message: 'Trial lessons require an ACCEPTED application' } },
    },
  }
  assert.equal(
    trialLessonErrorMessage(error),
    'Trial lessons require an ACCEPTED application',
  )
})

test('order detail links student creation to exact application and order context', () => {
  assert.equal(
    orderTrialLessonPath('student', { id: 21, application_id: 11 }),
    '/student/trial-lessons?application_id=11&order_id=21',
  )
  assert.equal(
    orderTrialLessonPath('parent', { id: 21, application_id: 11 }),
    '/parent/trial-lessons',
  )
})

test('API client keeps the backend create and confirmation contracts', async () => {
  const source = await readFile(
    new URL('../src/api/trialLesson.js', import.meta.url),
    'utf8',
  )
  assert.match(source, /client\.post\(\s*`\/applications\/\$\{applicationId\}\/trial-lessons`,\s*data/)
  assert.match(source, /client\.post\(`\/trial-lessons\/\$\{trialLessonId\}\/confirm`\)/)
})

test('mobile trial form uses one-column, non-overflowing controls at RC widths', async () => {
  const css = await readFile(new URL('../src/styles/mobile.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.trial-form,[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /\.trial-form input,[\s\S]*box-sizing: border-box;[\s\S]*width: 100%/)
  assert.match(css, /@media \(max-width: 380px\)/)
})
