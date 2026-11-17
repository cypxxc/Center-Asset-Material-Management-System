import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findPoolMismatch, type PoolAuditEvidence } from '../../features/disbursements/pool-audit'

const base: PoolAuditEvidence = {
  id: 'asset', item_name: 'โต๊ะ', asset_no: null, is_central: true, note: 'ส่วนกลาง',
  event_type: 'handover', item_condition: 'normal', event_at: '2026-11-12', document_no: null, document_id: null, active_borrow: false,
}
test('legacy issued and borrowed assets still marked central are flagged', () => {
  assert.equal(findPoolMismatch(base)?.expected_central, false)
  assert.equal(findPoolMismatch({ ...base, event_type: 'borrow' })?.expected_central, false)
})
test('returned assets missing central flag are flagged and active loans override older returns', () => {
  assert.equal(findPoolMismatch({ ...base, event_type: 'return', is_central: false, note: '' })?.expected_central, true)
  assert.equal(findPoolMismatch({ ...base, event_type: 'return', active_borrow: true })?.expected_central, false)
})
test('lost assets stay outside the pool and both central representations are checked', () => {
  assert.equal(findPoolMismatch({ ...base, event_type: 'return', item_condition: 'lost' })?.expected_central, false)
  assert.equal(findPoolMismatch({ ...base, is_central: false, note: 'หมายเหตุอื่น' }), null)
  assert.equal(findPoolMismatch({ ...base, is_central: false })?.note_mismatch, true)
})
