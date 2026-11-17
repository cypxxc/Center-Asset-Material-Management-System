import test from 'node:test'
import assert from 'node:assert/strict'
import { parseImportQuantity, assertNoDuplicateMaterials, resolvedMaterialCategory } from './import-validation'
import { itemFormSchema } from './schema'

test('import preserves zero and rejects corrupt quantities instead of defaulting to one', () => {
  assert.equal(parseImportQuantity('0'), 0)
  assert.equal(parseImportQuantity('1,250'), 1250)
  assert.equal(parseImportQuantity(''), 1)
  for (const input of ['-2', '1.5', '3abc', 'NaN', '1,2', 'Infinity']) {
    assert.throws(() => parseImportQuantity(input))
  }
})

const material = { item_type: 'material', item_name: 'Paper A4 80gsm', category_name: 'Office', unit_name: 'ream', location_name: 'Store', note: null }
test('material duplicates are rejected within the batch and against inventory', () => {
  assert.throws(() => assertNoDuplicateMaterials([material, { ...material, item_name: ' Paper A4 80gsm ' }], []), /ซ้ำ/)
  assert.throws(() => assertNoDuplicateMaterials([material], [material]), /ซ้ำ/)
  assert.doesNotThrow(() => assertNoDuplicateMaterials([material, { ...material, item_name: 'Paper A4 100gsm' }], []))
  assert.doesNotThrow(() => assertNoDuplicateMaterials([{ ...material, item_type: 'asset' }], [material]))
})
test('source provenance prevents importing the same source row after renaming', () => {
  const original = { ...material, note: '[CAMMS-MATERIAL-2570:1:1]' }
  assert.throws(() => assertNoDuplicateMaterials([{ ...original, item_name: 'Renamed paper' }], [original]), /ซ้ำ/)
})

test('source provenance also prevents duplicates from future years and new categories', () => {
  const original = { ...material, note: JSON.stringify({ source_key: '[CAMMS-MATERIAL-2571:category-new:1]' }) }
  assert.throws(() => assertNoDuplicateMaterials([{ ...original, item_name: 'Renamed' }], [original]), /ซ้ำ/)
})
test('material schema accepts a zero balance, while asset validation stays positive', () => {
  const data = { item_name: 'Paper', item_type: 'material', quantity: 0, status: 'active', image_url: '', acquired_date: null, depreciation_enabled: false }
  assert.equal(itemFormSchema.safeParse(data).success, true)
  assert.equal(itemFormSchema.safeParse({ ...data, quantity: -1 }).success, false)
  assert.equal(itemFormSchema.safeParse({ ...data, item_type: 'asset' }).success, false)
  for (const quantity of ['', ' ', null, undefined]) assert.equal(itemFormSchema.safeParse({ ...data, quantity }).success, false)
})
test('same source name with different specifications remains separate without renaming', () => {
  const first = { ...material, note: JSON.stringify({ source_fields: { specification: '80 gsm' } }) }
  const second = { ...material, note: JSON.stringify({ source_fields: { specification: '100 gsm' } }) }
  assert.doesNotThrow(() => assertNoDuplicateMaterials([first, second], []))
})
test('category prefixes and existing aliases cannot bypass duplicate detection', () => {
  assert.throws(() => assertNoDuplicateMaterials([{ ...material, category_name: '1234 - Office' }], [material]), /ซ้ำ/)
  const category = resolvedMaterialCategory('Office supplies alias', [{ name: 'Office', description: 'Office supplies alias' }])
  assert.throws(() => assertNoDuplicateMaterials([{ ...material, category_name: category }], [material]), /ซ้ำ/)
})
