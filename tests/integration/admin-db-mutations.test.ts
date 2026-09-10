import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry as db } from '../mocks/supabase'
import { upsertTableRow, deleteTableRow, getTableData } from '@/features/admin/actions'
const id = '12345678-1234-4234-8234-123456789abc'
function admin() {
  db.clear()
  db.setAuth({ id, email: 'admin@example.com' }, { id, role: 'admin', is_active: true, email: 'admin@example.com' })
}
function mutations() { return db.getQueryLog().filter(q => q.operations.some(op => ['insert', 'update', 'delete'].includes(op[0]))) }
test('DB panel rejects forbidden operations and invalid payloads before any mutation', async () => {
  for (const [table, rowId, payload] of [
    ['audit_logs', null, { action: 'FORGED' }],
    ['profiles', null, { full_name: 'Name', role: 'admin' }],
    ['categories', null, { name: 'Category', role: 'admin' }],
    ['items', null, { item_name: 'Item', item_type: 'invalid' }],
    ['items', null, { item_name: 'Item', item_type: 'asset', quantity: -1 }],
    ['profiles', id, { role: 'viewer' }],
    ['profiles', id, { is_active: false }],
    ['locations', null, { name: 'Room', is_active: 'false' }],
  ] as const) {
    admin()
    assert.ok((await upsertTableRow(table, rowId, payload)).error)
    assert.deepEqual(mutations(), [])
  }
  admin()
  assert.ok((await deleteTableRow('audit_logs', id)).error)
  assert.ok((await deleteTableRow('profiles', id)).error)
  assert.deepEqual(mutations(), [])
  assert.ok((await getTableData('secret')).error)
})
test('DB panel accepts registry inserts and strips only known full-row metadata', async () => {
  admin()
  assert.equal((await upsertTableRow('locations', null, { name: 'Room', building: 'B', floor: '2', room: '201', department: 'IT', description: '', is_active: true })).success, true)
  admin()
  assert.equal((await upsertTableRow('categories', id, { id, name: 'Updated', description: '', is_active: false, created_at: 'old', updated_at: 'old' })).success, true)
  const update = mutations().find(q => q.table === 'categories')!
  assert.deepEqual(update.operations[0][1], { name: 'Updated', description: null, is_active: false })
  admin()
  assert.equal((await deleteTableRow('units', id)).success, true)
})

test('item updates validate merged depreciation state while preserving omitted fields', async () => {
  const existing = { id, item_name: 'Asset', item_type: 'asset', quantity: 1, depreciation_enabled: true, depreciation_method: 'straight_line', depreciation_cost: 100, depreciation_useful_life_years: 5, depreciation_start_basis: 'manual', depreciation_start_date: '2025-01-01', depreciation_residual_value: 1, image_url: null }
  admin()
  db.setTableResponse('items', existing)
  assert.ok((await upsertTableRow('items', id, { item_type: 'material' })).error)
  assert.deepEqual(mutations(), [])
  admin()
  db.setTableResponse('items', existing)
  assert.equal((await upsertTableRow('items', id, { item_name: 'Renamed' })).success, true)
  assert.deepEqual(mutations().find(q => q.table === 'items')!.operations[0][1], { item_name: 'Renamed', updated_by: id })
  admin()
  assert.equal((await upsertTableRow('items', null, { item_name: 'Material', item_type: 'material', quantity: 1 })).success, true)
})
