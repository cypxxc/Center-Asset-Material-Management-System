import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ApplicationError,
  AuthorizationError,
  isApplicationError,
  toSafeErrorMessage,
} from '@/lib/errors'

test('typed errors carry codes, status codes, and details', () => {
  const details = { field: 'name' }
  const error = new ApplicationError('bad input', 'VALIDATION_ERROR', 400, { details })
  assert.equal(error.code, 'VALIDATION_ERROR')
  assert.equal(error.statusCode, 400)
  assert.equal(error.details, details)
  assert.equal(new AuthorizationError().code, 'AUTHORIZATION_ERROR')
  assert.equal(new AuthorizationError().statusCode, 403)
})

test('isApplicationError identifies typed errors', () => {
  assert.equal(isApplicationError(new ApplicationError('x', 'UNEXPECTED', 500)), true)
  assert.equal(isApplicationError(new Error('x')), false)
})

test('toSafeErrorMessage returns message for operational errors only', () => {
  assert.equal(toSafeErrorMessage(new ApplicationError('ชื่อไม่ถูกต้อง', 'VALIDATION_ERROR', 400)), 'ชื่อไม่ถูกต้อง')
  assert.equal(toSafeErrorMessage(new Error('secret stack')), 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง')
})
