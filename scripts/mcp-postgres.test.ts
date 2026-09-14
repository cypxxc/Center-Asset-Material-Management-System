import test from 'node:test'
import assert from 'node:assert/strict'
import { createPostgresMcp } from './mcp-postgres'

test('PostgreSQL MCP requires explicit local identity and connection configuration', () => {
  assert.throws(() => createPostgresMcp({ NODE_ENV: 'test' }), /MCP_POSTGRES_PROFILE_ID/)
  assert.throws(() => createPostgresMcp({ NODE_ENV: 'test', MCP_POSTGRES_PROFILE_ID: 'admin' }), /MCP_POSTGRES_PROFILE_ID/)
  assert.throws(() => createPostgresMcp({ NODE_ENV: 'test', MCP_POSTGRES_PROFILE_ID: '11111111-1111-4111-8111-111111111111' }), /DATABASE_URL/)
})

test('PostgreSQL MCP defaults to read-only and rejects writes before connecting', async () => {
  const mcp = createPostgresMcp({ NODE_ENV: 'test', DATABASE_URL: 'postgres://camms_app:unused@localhost:1/test', MCP_POSTGRES_PROFILE_ID: '11111111-1111-4111-8111-111111111111' })
  try {
    assert.equal(mcp.writeEnabled, false)
    for (const tool of ['create_item', 'update_item', 'delete_item']) await assert.rejects(mcp.execute(tool), /MCP write tools are disabled/)
    await assert.rejects(mcp.execute('execute_sql', { query: 'select 1' }), /Tool not found/)
  } finally { await mcp.close() }
})
