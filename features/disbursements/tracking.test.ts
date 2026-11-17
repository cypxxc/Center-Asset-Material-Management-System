import test from 'node:test'
import assert from 'node:assert/strict'
import { handoverDecision, parseMaterialApprovalSlaHours, pendingApprovalTracking } from './tracking'

test('material approval SLA is explicitly configured; missing or invalid settings never expire requests', () => {
  for (const value of [undefined, '', '0', '-1', 'nonsense', 'Infinity']) assert.equal(parseMaterialApprovalSlaHours(value), null)
  assert.equal(parseMaterialApprovalSlaHours(' 24 '), 24)
  assert.equal(parseMaterialApprovalSlaHours('0.5'), 0.5)
})

test('pending material age and reminders use submitted time and the configured boundary', () => {
  const doc = { transaction_type: 'material_issue', status: 'pending_approval', created_at: '2026-11-14T00:00:00Z', submitted_at: '2026-11-16T00:00:00Z' }
  const now = new Date('2026-11-16T12:00:00Z')
  assert.deepEqual(pendingApprovalTracking(doc, null, now), { ageHours: 12, overdue: false, slaHours: null })
  assert.equal(pendingApprovalTracking(doc, 12, now)?.overdue, true)
  assert.equal(pendingApprovalTracking(doc, 12.1, now)?.overdue, false)
  assert.equal(pendingApprovalTracking({ ...doc, status: 'confirmed' }, 1, now), null)
  assert.equal(pendingApprovalTracking({ ...doc, transaction_type: 'asset_borrow' }, 1, now), null)
})

test('legacy pending age falls back to creation without inventing a submitted timestamp', () => {
  assert.equal(pendingApprovalTracking({ transaction_type: 'material_issue', status: 'pending_approval', created_at: '2026-11-16T00:00:00Z' }, null, new Date('2026-11-16T06:00:00Z'))?.ageHours, 6)
})

test('actual handover requires approval; duplicate marking preserves the original event', () => {
  assert.equal(handoverDecision({ transaction_type: 'material_issue', status: 'confirmed', handed_over_at: null }), 'mark')
  assert.equal(handoverDecision({ transaction_type: 'asset_handover', status: 'confirmed', handed_over_at: null }), 'mark')
  assert.equal(handoverDecision({ transaction_type: 'asset_borrow', status: 'active_borrow', handed_over_at: null }), 'mark')
  assert.equal(handoverDecision({ transaction_type: 'material_issue', status: 'reversed', handed_over_at: '2026-11-16T00:00:00Z' }), 'existing')
  for (const status of ['draft', 'pending_approval', 'rejected', 'cancelled', 'reversed', 'returned', 'partially_returned']) {
    assert.throws(() => handoverDecision({ transaction_type: 'material_issue', status, handed_over_at: null }), /อนุมัติ/)
  }
})
