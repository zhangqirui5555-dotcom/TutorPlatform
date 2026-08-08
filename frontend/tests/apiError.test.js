import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  apiErrorMessage,
  normalizeApiError,
} from '../src/utils/apiError.js'

function responseError(status, code, message = 'Internal technical message') {
  return {
    response: {
      status,
      data: {
        error: { code, message },
      },
    },
  }
}

test('HTTP status fallbacks are safe Chinese messages', () => {
  const expected = new Map([
    [400, '请求信息有误，请检查后重试。'],
    [401, '登录状态已失效，请重新登录。'],
    [403, '你没有权限执行此操作。'],
    [404, '相关内容不存在或已被删除。'],
    [409, '当前状态已发生变化，请刷新后重试。'],
  ])

  for (const [status, message] of expected) {
    assert.equal(apiErrorMessage(responseError(status)), message)
  }
})

test('business codes take priority over English backend messages', () => {
  const scenarios = [
    ['EMAIL_ALREADY_EXISTS', '该邮箱已注册，请直接登录或使用其他邮箱。'],
    ['TRIAL_LESSON_NOT_ENDED', '试课尚未结束，暂不能标记为完成。'],
    ['DEMAND_NOT_AVAILABLE', '当前家教需求暂不可申请。'],
    ['INVALID_ORDER_STATUS', '订单状态已发生变化，请刷新后重试。'],
    ['ORDER_ALREADY_UPDATED', '订单状态已发生变化，请刷新后重试。'],
  ]

  for (const [code, message] of scenarios) {
    assert.equal(apiErrorMessage(responseError(409, code)), message)
  }
})

test('approved Chinese business messages remain available', () => {
  assert.equal(
    apiErrorMessage(responseError(422, 'CUSTOM_RULE', '现有业务中文提示。')),
    '现有业务中文提示。',
  )
})

test('unknown server, technical and network failures never expose raw details', () => {
  assert.equal(
    apiErrorMessage(responseError(500, 'DATABASE_FAILURE', 'Prisma connection failed')),
    '操作未完成，请稍后重试。',
  )
  assert.equal(
    apiErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error', request: {} }),
    '网络连接异常，请稍后重试。',
  )
  assert.equal(
    apiErrorMessage(new Error('AxiosError: request failed')),
    '操作未完成，请稍后重试。',
  )
})

test('the Axios normalization layer replaces user-visible technical messages', () => {
  const error = responseError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered')
  normalizeApiError(error)

  assert.equal(error.userMessage, '该邮箱已注册，请直接登录或使用其他邮箱。')
  assert.equal(
    error.response.data.error.message,
    '该邮箱已注册，请直接登录或使用其他邮箱。',
  )
})

test('registration and login use the shared error mapping layer', async () => {
  const [registerSource, loginSource] = await Promise.all([
    readFile(new URL('../src/pages/RegisterPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8'),
  ])

  assert.match(registerSource, /apiErrorMessage\(requestError/)
  assert.match(loginSource, /apiErrorMessage\(requestError/)
  assert.doesNotMatch(registerSource, /response\?\.data\?\.error\?\.message/)
  assert.doesNotMatch(loginSource, /response\?\.data\?\.error\?\.message/)
})
