import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { PendingApprovalIndicator } from './components/tracking-pending-indicator'

test('pending indicator distinguishes the in-app reminder from approval and actual handover', () => {
  const doc = { transaction_type: 'material_issue', status: 'pending_approval', created_at: '2026-11-16T00:00:00Z' }
  const markup = renderToStaticMarkup(<PendingApprovalIndicator doc={doc} slaHours={6} now="2026-11-16T12:00:00Z" />)
  assert.match(markup, /เกินเวลาติดตาม/)
  assert.match(markup, /12/)
  assert.match(markup, /รออนุมัติ/)
  const unconfigured = renderToStaticMarkup(<PendingApprovalIndicator doc={doc} slaHours={null} now="2026-11-16T12:00:00Z" />)
  assert.doesNotMatch(unconfigured, /เกินเวลาติดตาม/)
  assert.equal(renderToStaticMarkup(<PendingApprovalIndicator doc={{ ...doc, status: 'confirmed' }} slaHours={6} now="2026-11-16T12:00:00Z" />), '')
})
