import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disbursementDraftSchema } from './schema'
import { approvalBorrowDueDate, bangkokCalendarDate, borrowDueDateError } from './borrow-dates'

const draft = (due_date: string) => ({ transaction_type: 'asset_borrow', recipient_name: 'ผู้ยืม', department_name: 'งาน', purpose: 'งานราชการ', due_date, items: [{ item_id: '11111111-1111-4111-8111-111111111111', requested_qty: 1 }] })

test('new borrowing rejects a past calendar date even when the format is valid', () => {
  assert.equal(disbursementDraftSchema.safeParse(draft('2000-01-01')).success, false)
})

test('Bangkok midnight changes date validation while allowing the same calendar day', () => {
  const before = new Date('2026-11-15T16:59:59Z')
  const after = new Date('2026-11-15T17:00:00Z')
  assert.equal(bangkokCalendarDate(before), '2026-11-15')
  assert.equal(bangkokCalendarDate(after), '2026-11-16')
  assert.equal(borrowDueDateError('2026-11-15', undefined, before), null)
  assert.match(borrowDueDateError('2026-11-15', undefined, after)!, /วันปัจจุบัน/)
  assert.equal(borrowDueDateError('2026-11-16', undefined, after), null)
})

test('due date cannot precede the request start date in Bangkok', () => {
  assert.match(borrowDueDateError('2026-11-16', '2026-11-16T17:00:00Z', new Date('2026-11-15T17:00:00Z'))!, /วันที่ส่งคำขอ/)
})

test('stale approval requires an explicit valid replacement and retains a valid original', () => {
  const now = new Date('2026-11-16T06:00:00Z')
  assert.throws(() => approvalBorrowDueDate('2026-11-15', undefined, undefined, now), /กำหนดส่งคืนใหม่/)
  assert.throws(() => approvalBorrowDueDate('2026-11-15', '2026-11-15', undefined, now), /วันปัจจุบัน/)
  assert.throws(() => approvalBorrowDueDate('2026-11-15', '2026-02-30', undefined, now), /YYYY-MM-DD/)
  assert.equal(approvalBorrowDueDate('2026-11-15', '2026-11-16', undefined, now), '2026-11-16')
  assert.equal(approvalBorrowDueDate('2026-11-16', undefined, undefined, now), '2026-11-16')
})

test('an old date does not gate ordinary material issue drafts', () => {
  assert.equal(disbursementDraftSchema.safeParse({ ...draft('2000-01-01'), transaction_type: 'material_issue' }).success, true)
})
