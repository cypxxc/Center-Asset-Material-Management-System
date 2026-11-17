import { test } from 'node:test'
import assert from 'node:assert/strict'
import { submitBorrowRequestSchema } from '../../features/disbursements/schema'

const base = {
  item_ids: ['00000000-0000-4000-8000-000000000001'],
  purpose: 'ใช้งานในสำนักงาน',
}

test('issue requests do not require a return date and discard a stale date', () => {
  const result = submitBorrowRequestSchema.parse({ ...base, request_type: 'issue', due_date: '2026-12-01' })
  assert.equal(result.request_type, 'issue')
  assert.equal(result.due_date, null)
  assert.equal(submitBorrowRequestSchema.safeParse({ ...base, request_type: 'issue' }).success, true)
})

test('borrow requests require a return date', () => {
  assert.equal(submitBorrowRequestSchema.safeParse({ ...base, request_type: 'borrow' }).success, false)
  assert.equal(submitBorrowRequestSchema.safeParse({ ...base, request_type: 'borrow', due_date: '2026-12-01' }).success, true)
})

test('legacy requests default to borrowing and invalid modes are rejected', () => {
  assert.equal(submitBorrowRequestSchema.parse({ ...base, due_date: '2026-12-01' }).request_type, 'borrow')
  assert.equal(submitBorrowRequestSchema.safeParse({ ...base, request_type: 'invalid' }).success, false)
})
