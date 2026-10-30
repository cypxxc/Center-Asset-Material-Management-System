import test from 'node:test'
import assert from 'node:assert/strict'
import { getAllScenarios, ADMIN_SCENARIOS, STAFF_SCENARIOS, VIEWER_SCENARIOS } from '../../scripts/ai-uat/scenarios'

test('getAllScenarios returns all 3 roles with expected test IDs', () => {
  const all = getAllScenarios()
  const ids = all.map(s => s.id)
  assert.ok(ids.includes('TC-ADM-01'))
  assert.ok(ids.includes('TC-ADM-02'))
  assert.ok(ids.includes('TC-ADM-03'))
  assert.ok(ids.includes('TC-STF-01'))
  assert.ok(ids.includes('TC-STF-02'))
  assert.ok(ids.includes('TC-VIW-01'))
  assert.ok(ids.includes('TC-VIW-02'))
})

test('getAllScenarios filters by specific role', () => {
  const adminOnly = getAllScenarios('admin')
  assert.ok(adminOnly.length > 0)
  assert.ok(adminOnly.every(s => s.role === 'admin'))

  const staffOnly = getAllScenarios('staff')
  assert.ok(staffOnly.length > 0)
  assert.ok(staffOnly.every(s => s.role === 'staff'))

  const viewerOnly = getAllScenarios('viewer')
  assert.ok(viewerOnly.length > 0)
  assert.ok(viewerOnly.every(s => s.role === 'viewer'))
})
