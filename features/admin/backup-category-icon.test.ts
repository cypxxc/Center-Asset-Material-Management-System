import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBusinessBackup } from './postgres-policy'

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
