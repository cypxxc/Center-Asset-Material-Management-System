import test from 'node:test'
import assert from 'node:assert/strict'
import { requestFingerprint, batchSummary } from './request-batch'

test('cart fingerprint ignores order and defaults but includes quantity, action, date and purpose', () => {
  const a = { item_ids: ['b', 'a'], quantities: { b: 2 }, item_actions: { a: 'borrow' as const }, request_type: 'issue' as const, due_date: '2027-01-01', purpose: ' ใช้งาน ' }
  assert.equal(requestFingerprint(a), requestFingerprint({ ...a, item_ids: ['a', 'b'], quantities: { a: 1, b: 2 }, item_actions: { a: 'borrow', b: 'issue' }, purpose: 'ใช้งาน' }))
  assert.notEqual(requestFingerprint(a), requestFingerprint({ ...a, quantities: { b: 3 } }))
  assert.notEqual(requestFingerprint(a), requestFingerprint({ ...a, due_date: '2027-01-02' }))
  assert.notEqual(requestFingerprint(a), requestFingerprint({ ...a, item_actions: { a: 'issue' } }))
})

test('batch summary derives mixed child states without pretending they are all complete', () => {
  assert.equal(batchSummary(['pending_approval', 'confirmed']), 'ดำเนินการบางส่วน')
  assert.equal(batchSummary(['pending_approval', 'pending_approval']), 'รออนุมัติ')
  assert.equal(batchSummary(['returned', 'cancelled']), 'สิ้นสุดแล้ว')
  assert.equal(batchSummary([]), 'ไม่มีเอกสาร')
})
