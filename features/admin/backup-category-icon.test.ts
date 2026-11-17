import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBusinessBackup } from './postgres-policy'

test('legacy backups split shared categories and preserve exclusive material IDs', () => {
  const shared = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const materialOnly = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
  const backup = parseBusinessBackup(JSON.stringify({ __meta: { version: 1 }, profiles: [], locations: [], units: [], audit_logs: [],
    categories: [{id: shared, name: 'สำนักงาน', icon: 'Tag'}, {id: materialOnly, name: 'กระดาษ'}],
    items: [{id:'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',item_type:'asset',category_id:shared}],
    materials: [
      {id:'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',item_type:'material',category_id:shared,deleted_at:'2020-01-01'},
      {id:'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',item_type:'material',category_id:materialOnly},
    ],
  }))
  assert.equal(backup.categories.length, 3)
  assert.equal(backup.categories.find(c=>c.id === shared)?.item_type, 'asset')
  assert.equal(backup.categories.find(c=>c.id === materialOnly)?.item_type, 'material')
  const clone = backup.categories.find(c=>c.name === 'สำนักงาน' && c.item_type === 'material')!
  assert.notEqual(clone.id, shared)
  assert.equal(clone.icon, 'Tag')
  assert.equal(backup.materials[0].category_id, clone.id)
  assert.equal(backup.materials[0].deleted_at, '2020-01-01')
  assert.equal(backup.materials[1].category_id, materialOnly)
  assert.equal(backup.items[0].category_id, shared)
})

test('parseBusinessBackup supports both legacy backups (without icon) and modern backups (with icon)', () => {
  const baseBackup = {
    __meta: { version: 1 },
    profiles: [],
    categories: [],
    locations: [],
    units: [],
    items: [],
    audit_logs: [],
  }

  // 1. Legacy backup: category has no 'icon' field
  const legacyCategory = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'ครุภัณฑ์สำนักงาน',
    description: '7110',
    color: '#10B981',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  const legacyPayload = JSON.stringify({
    ...baseBackup,
    categories: [legacyCategory],
  })

  const parsedLegacy = parseBusinessBackup(legacyPayload)
  assert.equal(parsedLegacy.categories.length, 1)
  assert.equal(parsedLegacy.categories[0].name, 'ครุภัณฑ์สำนักงาน')
  assert.equal(parsedLegacy.categories[0].color, '#10B981')
  assert.equal(parsedLegacy.categories[0].icon, undefined)

  // 2. Modern backup: category has explicit 'icon' field
  const modernCategory = {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'ครุภัณฑ์คอมพิวเตอร์',
    description: '7440',
    color: '#3B82F6',
    icon: 'Laptop',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  const modernPayload = JSON.stringify({
    ...baseBackup,
    categories: [modernCategory],
  })

  const parsedModern = parseBusinessBackup(modernPayload)
  assert.equal(parsedModern.categories.length, 1)
  assert.equal(parsedModern.categories[0].name, 'ครุภัณฑ์คอมพิวเตอร์')
  assert.equal(parsedModern.categories[0].color, '#3B82F6')
  assert.equal(parsedModern.categories[0].icon, 'Laptop')
})

test('parseBusinessBackup rejects unknown category properties', () => {
  const baseBackup = {
    __meta: { version: 1 },
    profiles: [],
    categories: [
      {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'ครุภัณฑ์',
        color: '#10B981',
        icon: 'Tag',
        malicious_injected_column: 'evil',
      },
    ],
    locations: [],
    units: [],
    items: [],
    audit_logs: [],
  }

  assert.throws(
    () => parseBusinessBackup(JSON.stringify(baseBackup)),
    /Unsupported backup field: categories\.malicious_injected_column/
  )
})

test('parseBusinessBackup supports asset ledger fields on items (gfmis_number, budget_source, acquired_date)', () => {
  const payload = {
    __meta: { version: 1 },
    profiles: [],
    categories: [],
    locations: [],
    units: [],
    items: [
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        item_name: 'ครุภัณฑ์ทดสอบ',
        item_type: 'asset',
        budget_source: 'งบดำเนินงาน',
        gfmis_number: '110000069558',
        acquired_date: '2026-01-15',
      },
    ],
    audit_logs: [],
  }

  const parsed = parseBusinessBackup(JSON.stringify(payload))
  assert.equal(parsed.items.length, 1)
  assert.equal(parsed.items[0].gfmis_number, '110000069558')
  assert.equal(parsed.items[0].budget_source, 'งบดำเนินงาน')
  assert.equal(parsed.items[0].acquired_date, '2026-01-15')
})
