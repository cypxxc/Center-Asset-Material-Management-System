import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ApplicationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  isApplicationError,
  toSafeErrorMessage,
} from '@/lib/errors'

test('typed errors carry codes and status codes', () => {
  assert.equal(new ValidationError('bad input').code, 'VALIDATION_ERROR')
  assert.equal(new ValidationError('bad input').statusCode, 400)
  assert.equal(new AuthorizationError().code, 'AUTHORIZATION_ERROR')
  assert.equal(new NotFoundError().statusCode, 404)
  assert.equal(new ConflictError('dup').code, 'CONFLICT')
  assert.equal(new RateLimitError().statusCode, 429)
})

test('isApplicationError identifies typed errors', () => {
  assert.equal(isApplicationError(new ApplicationError('x', 'UNEXPECTED', 500)), true)
  assert.equal(isApplicationError(new Error('x')), false)
})

test('toSafeErrorMessage returns message for operational errors only', () => {
  assert.equal(toSafeErrorMessage(new ValidationError('ชื่อไม่ถูกต้อง')), 'ชื่อไม่ถูกต้อง')
  assert.equal(toSafeErrorMessage(new Error('secret stack')), 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง')
})
