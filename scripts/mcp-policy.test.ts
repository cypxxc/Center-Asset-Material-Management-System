import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isMcpWriteEnabled,
  parseMcpCreateItem,
  parseMcpDeleteItem,
  parseMcpUpdateItem,
} from './mcp-policy'

const itemId = '8e0b33b4-e603-4d7b-8f21-10e733cead63'

test('MCP writes require both explicit opt-in and service role', () => {
  assert.equal(isMcpWriteEnabled({ NODE_ENV: 'test' }), false)
  assert.equal(isMcpWriteEnabled({ NODE_ENV: 'test', CAMMS_MCP_ALLOW_WRITE: 'true' }), false)
  assert.equal(isMcpWriteEnabled({
    NODE_ENV: 'test', CAMMS_MCP_ALLOW_WRITE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  }), true)
})

test('MCP create rejects unknown fields and invalid quantity', () => {
  assert.throws(() => parseMcpCreateItem({ item_name: 'A', item_type: 'asset', quantity: 0 }))
  assert.throws(() => parseMcpCreateItem({ item_name: 'A', item_type: 'asset', quantity: 1, role: 'admin' }))
})

test('MCP create accepts approved nullable relation fields', () => {
  assert.deepEqual(parseMcpCreateItem({
    item_name: 'A', item_type: 'asset', quantity: 1, category_id: null, unit_id: null,
  }), {
    item_name: 'A', item_type: 'asset', quantity: 1, category_id: null, unit_id: null,
  })
})

test('MCP update requires a UUID and at least one approved field', () => {
  assert.throws(() => parseMcpUpdateItem({ id: 'not-a-uuid', updates: { quantity: 1 } }))
  assert.throws(() => parseMcpUpdateItem({ id: itemId, updates: {} }))
  assert.throws(() => parseMcpUpdateItem({ id: itemId, updates: { role: 'admin' } }))
  assert.deepEqual(parseMcpUpdateItem({ id: itemId, updates: { quantity: 2 } }), {
    id: itemId, updates: { quantity: 2 },
  })
})

test('MCP delete accepts only a strict UUID argument', () => {
  assert.deepEqual(parseMcpDeleteItem({ id: itemId }), { id: itemId })
  assert.throws(() => parseMcpDeleteItem({ id: 'not-a-uuid' }))
  assert.throws(() => parseMcpDeleteItem({}))
  assert.throws(() => parseMcpDeleteItem({ id: itemId, role: 'admin' }))
})
