import test from 'node:test'
import assert from 'node:assert/strict'
import { isMcpWriteEnabled, parseMcpCreateItem, parseMcpUpdateItem } from './mcp-policy'

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

test('MCP update requires id and at least one approved field', () => {
  assert.throws(() => parseMcpUpdateItem({ id: 'not-a-uuid', updates: {} }))
})
