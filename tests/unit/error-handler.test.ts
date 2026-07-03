import { test } from 'node:test'
import assert from 'node:assert'
import { handleActionError } from '@/lib/error-handler'

import { ValidationError } from '@/lib/errors'

test('handleActionError returns typed error message for ApplicationError', async () => {
  const result = await handleActionError(new ValidationError('ชื่อไม่ถูกต้อง'), 'testOp', 'testFeature')
  assert.strictEqual(result.message, 'ชื่อไม่ถูกต้อง')
})

test('handleActionError returns localized safe message and does not throw', async () => {
  const result = await handleActionError(new Error('Sensitive DB Stack Trace'), 'testOp', 'testFeature')
  
  assert.strictEqual(result.success, false)
  assert.strictEqual(result.message, 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง')
  assert.strictEqual(result.error, 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง')
  assert.ok(!result.fieldErrors)
})

test('handleActionError re-throws NEXT_REDIRECT error', async () => {
  const redirectErr = new Error('NEXT_REDIRECT')
  await assert.rejects(
    async () => {
      await handleActionError(redirectErr, 'testOp', 'testFeature')
    },
    (err: any) => err.message === 'NEXT_REDIRECT'
  )
  
  const digestErr = new Error('Some redirect')
  ;(digestErr as any).digest = 'NEXT_REDIRECT;action=123'
  await assert.rejects(
    async () => {
      await handleActionError(digestErr, 'testOp', 'testFeature')
    },
    (err: any) => err.digest === 'NEXT_REDIRECT;action=123'
  )
})
