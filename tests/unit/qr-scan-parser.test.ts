import test from 'node:test'
import assert from 'node:assert/strict'
import { parseScannedAssetCode } from '../../lib/qr-scan-parser'

test('parseScannedAssetCode extracts item ID from full URL', () => {
  const result = parseScannedAssetCode('https://camms.health.go.th/items/item-xyz-123')
  assert.equal(result.type, 'item_id')
  assert.equal(result.value, 'item-xyz-123')

  const resultWithQuery = parseScannedAssetCode('http://localhost:3000/items/item-999?source=qr')
  assert.equal(resultWithQuery.type, 'item_id')
  assert.equal(resultWithQuery.value, 'item-999')
})

test('parseScannedAssetCode identifies UUID strings as item_id', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  const result = parseScannedAssetCode(uuid)
  assert.equal(result.type, 'item_id')
  assert.equal(result.value, uuid)
})

test('parseScannedAssetCode treats raw asset code as asset_no', () => {
  const code = 'AST-2026-789'
  const result = parseScannedAssetCode(code)
  assert.equal(result.type, 'asset_no')
  assert.equal(result.value, 'AST-2026-789')
})

test('parseScannedAssetCode trims whitespace correctly', () => {
  const result = parseScannedAssetCode('   SN-999988   ')
  assert.equal(result.type, 'asset_no')
  assert.equal(result.value, 'SN-999988')
})
