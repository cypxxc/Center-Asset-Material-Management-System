import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { buildAuditActionFilter } from '../../features/admin/audit-action-filter'
import { getAuditActionLabel, getAuditTableLabel } from '../../features/audit-log-display/format'

test('approval history filters existing audit events with bound parameters', () => {
  const query = new PgDialect().sqlToQuery(buildAuditActionFilter('approval_history')!)
  assert.match(query.sql, /lower\(a.action\) in/)
  assert.ok(query.params.includes('confirm_disbursement'))
  assert.ok(query.params.includes('reject_borrow_request'))
  assert.ok(query.params.includes('return_disbursement_item'))
  assert.equal(query.params.includes('request_borrow'), false)
  assert.equal(buildAuditActionFilter('all'), undefined)
  const update = new PgDialect().sqlToQuery(buildAuditActionFilter('UPDATE')!)
  assert.deepEqual(update.params, ['update'])
})

test('approval events have Thai labels in the shared Logs details', () => {
  assert.equal(getAuditActionLabel('CONFIRM_DISBURSEMENT'), 'อนุมัติเบิก–ยืม')
  assert.equal(getAuditActionLabel('REJECT_BORROW_REQUEST'), 'ไม่อนุมัติคำขอ')
  assert.equal(getAuditTableLabel('disbursements'), 'เอกสารเบิก–ยืม')
})
