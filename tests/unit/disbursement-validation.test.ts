import { test } from 'node:test'
import assert from 'node:assert/strict'
import { submitBorrowRequestSchema, disbursementDraftSchema, rejectDisbursementSchema, partialReturnDisbursementSchema } from '../../features/disbursements/schema'

const id = '00000000-0000-4000-8000-000000000001'
test('partial returns reject repeated line IDs even when conditions or UUID casing differ', () => {
  const line = { line_id: 'abcdefab-0000-4000-8000-abcdefabcdef', item_id: id, condition: 'lost', reason: 'Recorded loss' }
  const input = { disbursement_id: id, items: [line] }
  assert.equal(partialReturnDisbursementSchema.safeParse(input).success, true)
  assert.equal(partialReturnDisbursementSchema.safeParse({
    ...input,
    items: [line, { ...line, line_id: line.line_id.toUpperCase(), condition: 'normal' }],
  }).success, false)
})
test('requests reject duplicate inventory IDs', () => {
  assert.equal(submitBorrowRequestSchema.safeParse({ item_ids: [id, id], request_type: 'issue', purpose: 'office' }).success, false)
  const mixed = 'abcdefab-0000-4000-8000-abcdefabcdef'
  assert.equal(submitBorrowRequestSchema.safeParse({ item_ids: [mixed, mixed.toUpperCase()], request_type: 'issue', purpose: 'office' }).success, false)
})
test('borrow requests reject malformed and impossible dates', () => {
  for (const due_date of ['not-a-date', '2026-02-30', '2026-13-01']) {
    assert.equal(submitBorrowRequestSchema.safeParse({ item_ids: [id], request_type: 'borrow', due_date, purpose: 'office' }).success, false)
  }
})
test('drafts reject duplicate item lines', () => {
  assert.equal(disbursementDraftSchema.safeParse({ transaction_type: 'material_issue', recipient_name: 'User', department_name: 'Office', purpose: 'Office', items: [{ item_id: id, requested_qty: 1 }, { item_id: id, requested_qty: 1 }] }).success, false)
})
test('rejection reason is bounded and normalized', () => {
  assert.equal(rejectDisbursementSchema.safeParse({ disbursement_id: id, reason: 'x'.repeat(501) }).success, false)
})

test('tracked asset drafts require one physical asset per line', () => {
  const draft = { transaction_type: 'asset_borrow', recipient_name: 'User', department_name: 'Office', purpose: 'Meeting', due_date: '2099-01-01', items: [{ item_id: id, requested_qty: 2 }] }
  assert.equal(disbursementDraftSchema.safeParse(draft).success, false)
  assert.equal(disbursementDraftSchema.safeParse({ ...draft, items: [{ item_id: id, requested_qty: 1 }] }).success, true)
})

test('group request limit permits twenty distinct assets and rejects twenty-one', () => {
  const ids = Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
  const request = { item_ids: ids, request_type: 'borrow', purpose: 'Meeting', due_date: '2099-01-01' }
  assert.equal(submitBorrowRequestSchema.safeParse(request).success, false)
  assert.equal(submitBorrowRequestSchema.safeParse({ ...request, item_ids: ids.slice(0, 20) }).success, true)
})
