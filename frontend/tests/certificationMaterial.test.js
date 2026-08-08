import assert from 'node:assert/strict'
import test from 'node:test'

import {
  certificationMaterialErrorMessage,
  tryOpenCertificationMaterial,
} from '../src/utils/certificationMaterial.js'

function responseError(status, code, message = 'Internal storage error') {
  return {
    response: {
      status,
      data: { error: { code, message } },
    },
  }
}

test('admin material errors distinguish unavailable, missing and forbidden results', () => {
  assert.equal(
    certificationMaterialErrorMessage(
      responseError(503, 'STORAGE_UNAVAILABLE', 'COS timeout'),
      'admin',
    ),
    '认证材料暂时无法读取，请稍后重试。',
  )
  assert.equal(
    certificationMaterialErrorMessage(
      responseError(404, 'STORAGE_OBJECT_NOT_FOUND'),
      'admin',
    ),
    '该认证材料当前无法读取，请联系学生重新提交。',
  )
  assert.equal(
    certificationMaterialErrorMessage(responseError(403, 'FORBIDDEN'), 'admin'),
    '你没有权限查看该认证材料。',
  )
})

test('student material errors provide actionable but safe guidance', () => {
  assert.equal(
    certificationMaterialErrorMessage(
      responseError(503, 'STORAGE_UNAVAILABLE', 'S3 service unavailable'),
      'student',
    ),
    '认证材料暂时无法读取，请稍后重试；如持续出现，请重新提交或联系平台处理。',
  )
  assert.equal(
    certificationMaterialErrorMessage(
      responseError(404, 'STORAGE_OBJECT_NOT_FOUND'),
      'student',
    ),
    '该认证材料当前无法读取，请重新提交或联系平台处理。',
  )
  assert.equal(
    certificationMaterialErrorMessage(responseError(403, 'FORBIDDEN'), 'student'),
    '你没有权限查看该认证材料。',
  )
})

test('unknown server and network errors never expose storage internals', () => {
  const unknownServer = responseError(500, 'INTERNAL_SERVER_ERROR', 'AWS credential failed')
  const network = { code: 'ERR_NETWORK', message: 'Network Error', request: {} }

  assert.equal(
    certificationMaterialErrorMessage(unknownServer, 'admin'),
    '认证材料暂时无法读取，请稍后重试。',
  )
  assert.equal(
    certificationMaterialErrorMessage(network, 'student'),
    '认证材料暂时无法读取，请稍后重试；如持续出现，请重新提交或联系平台处理。',
  )
})

test('successful material opening keeps the existing API call and reports no error', async () => {
  const calls = []
  const message = await tryOpenCertificationMaterial(async (...args) => {
    calls.push(args)
  }, 'certification-1', 'admin')

  assert.equal(message, '')
  assert.deepEqual(calls, [['certification-1', 'admin']])
})

test('failed material opening is converted to the audience-specific message', async () => {
  const message = await tryOpenCertificationMaterial(
    async () => {
      throw responseError(503, 'STORAGE_UNAVAILABLE')
    },
    'certification-2',
    'student',
  )

  assert.equal(
    message,
    '认证材料暂时无法读取，请稍后重试；如持续出现，请重新提交或联系平台处理。',
  )
})
