import test from 'node:test'
import assert from 'node:assert/strict'
import { submitBorrowRequestSchema } from './schema'

const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const base = { item_ids: [a, b], purpose: 'สำนักงาน' }

test('per-item borrowing requires a date even when the cart default is issue', () => {
  const raw = { ...base, request_type: 'issue', item_actions: { [a]: 'borrow', [b]: 'issue' } }
  assert.equal(submitBorrowRequestSchema.safeParse(raw).success, false)
  const parsed = submitBorrowRequestSchema.parse({ ...raw, due_date: '2026-12-01' })
  assert.equal(parsed.item_actions[a], 'borrow')
  assert.equal(parsed.item_actions[b], 'issue')
  assert.equal(parsed.due_date, '2026-12-01')
})

test('all issue overrides require no return date and unknown action IDs are rejected', () => {
  const parsed = submitBorrowRequestSchema.parse({ ...base, item_actions: { [a]: 'issue', [b]: 'issue' } })
  assert.equal(parsed.due_date, null)
  assert.equal(submitBorrowRequestSchema.safeParse({ item_ids: [a], purpose: 'test', request_type: 'issue', item_actions: { [b]: 'borrow' }, due_date: '2026-12-01' }).success, false)
  assert.equal(submitBorrowRequestSchema.safeParse({ ...base, request_type: 'issue', item_actions: { [a]: 'invalid' } }).success, false)
})

test('partial action maps defer type-dependent date requirements to inventory validation', () => {
  const parsed = submitBorrowRequestSchema.parse({ ...base, item_actions: { [b]: 'issue' } })
  assert.equal(parsed.due_date, null)
})
