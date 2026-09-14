import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { createPostgresMcp } from '../../scripts/mcp-postgres'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

test('fresh database migrates twice and real business restore commits or rolls back atomically', { skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1', timeout: 120_000 }, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const databaseName = `camms_verify_${randomUUID().replaceAll('-', '')}`
  assert.match(databaseName, /^camms_verify_[a-f0-9]{32}$/)
  const adminPool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const fixturePools: Pool[] = []
  let created = false
  function fixturePool(connection: string) {
    const url = new URL(connection)
    url.pathname = `/${databaseName}`
    const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 })
    fixturePools.push(pool)
    return pool
  }
  function mockModule(path: string, exports: unknown) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  try {
    await adminPool.query(`create database "${databaseName}"`)
    created = true
    const ownerPool = fixturePool(env.DATABASE_MIGRATION_URL)
    const owner = drizzle(ownerPool)
    await migrate(owner, { migrationsFolder: './db/postgres/migrations' })
    const migrationCount = await ownerPool.query('select count(*)::int as count from drizzle.__drizzle_migrations')
    await migrate(owner, { migrationsFolder: './db/postgres/migrations' })
    assert.deepEqual((await ownerPool.query('select count(*)::int as count from drizzle.__drizzle_migrations')).rows, migrationCount.rows)
    assert.equal((await ownerPool.query('select count(*)::int as count from public.items')).rows[0].count, 0)

    const actor = randomUUID()
    await ownerPool.query("insert into public.profiles(id,email,full_name,role) values($1,$2,'Restore fixture admin','admin')", [actor, `${actor}@example.com`])
    await ownerPool.query("insert into private_auth.credentials(user_id,password_hash) values($1,'preserved-credential')", [actor])
    await ownerPool.query("insert into private_auth.sessions(token_hash,user_id,expires_at) values('preserved-session',$1,now()+interval '1 day')", [actor])
    const categoryId = randomUUID()
    const itemId = randomUUID()
    await ownerPool.query("insert into public.categories(id,name) values($1,'Original category')", [categoryId])
    await ownerPool.query("insert into public.items(id,item_name,item_type,category_id,quantity,unit_price,created_by) values($1,'Original item','material',$2,2,25,$3)", [itemId, categoryId, actor])
    const runtime = drizzle(fixturePool(env.DATABASE_URL))
    const auth = drizzle(fixturePool(env.DATABASE_AUTH_URL))
    mockModule('../../features/auth/queries', { getCurrentProfile: async () => ({ id: actor, role: 'admin', is_active: true }) })
    mockModule('../../lib/postgres/db', { getAuthDatabase: () => auth })
    mockModule('../../lib/postgres/request', { withUserDatabase: async (callback: Parameters<typeof runtime.transaction>[0]) => runtime.transaction(async tx => {
      await tx.execute(sql`select set_config('app.user_id', ${actor}, true)`)
      return callback(tx)
    }) })
    const admin = await import('../../features/admin/postgres-admin')
    const exported = await admin.pgExportDatabaseData()
    assert.ok(exported.backup, JSON.stringify(exported))
    const backup = JSON.parse(JSON.stringify(exported.backup)) as Record<string, Array<Record<string, unknown>>>
    backup.items[0].item_name = 'Restored item'
    backup.items[0].created_by = randomUUID() // An author deleted after export must become null.
    const unrelated = randomUUID()
    await ownerPool.query("insert into public.categories(id,name) values($1,'Remove during restore')", [unrelated])
    const restored = await admin.pgImportDatabaseData(JSON.stringify(backup))
    assert.equal(restored.success, true, JSON.stringify(restored))
    const restoredItems = await ownerPool.query('select id,item_name,created_by from public.items')
    assert.deepEqual(restoredItems.rows, [{ id: itemId, item_name: 'Restored item', created_by: null }])
    assert.equal((await ownerPool.query('select id from public.categories where id=$1', [unrelated])).rowCount, 0)
    assert.equal((await ownerPool.query('select password_hash from private_auth.credentials where user_id=$1', [actor])).rows[0].password_hash, 'preserved-credential')
    assert.equal((await ownerPool.query("select token_hash from private_auth.sessions where token_hash='preserved-session'")).rowCount, 1)
    assert.equal((await ownerPool.query("select id from public.audit_logs where action='backup_restore'")).rowCount, 1)

    const snapshot = async () => (await ownerPool.query(`select
      (select jsonb_agg(to_jsonb(i) order by id) from public.items i) as items,
      (select jsonb_agg(to_jsonb(c) order by id) from public.categories c) as categories,
      (select count(*)::int from public.audit_logs) as audit_count`)).rows
    const beforeFailure = await snapshot()
    backup.items[0].category_id = randomUUID()
    const failed = await admin.pgImportDatabaseData(JSON.stringify(backup))
    assert.ok(failed.error)
    assert.notEqual(failed.success, true)
    assert.deepEqual(await snapshot(), beforeFailure, 'failed FK insert must roll back earlier deletes, inserts and audit triggers')

    // Exercise the standalone CLI adapter against the same isolated database.
    const runtimeUrl = new URL(env.DATABASE_URL)
    runtimeUrl.pathname = `/${databaseName}`
    const viewer = randomUUID()
    await ownerPool.query("insert into public.profiles(id,email,full_name,role) values($1,$2,'MCP viewer','viewer')", [viewer, `${viewer}@example.com`])
    const mcpEnv = { ...process.env, DATABASE_URL: runtimeUrl.toString(), MCP_POSTGRES_PROFILE_ID: actor }
    const readOnly = createPostgresMcp({ ...mcpEnv, CAMMS_MCP_ALLOW_WRITE: 'false' })
    const writer = createPostgresMcp({ ...mcpEnv, CAMMS_MCP_ALLOW_WRITE: 'true' })
    const restricted = createPostgresMcp({ ...mcpEnv, MCP_POSTGRES_PROFILE_ID: viewer, CAMMS_MCP_ALLOW_WRITE: 'true' })
    try {
      assert.equal(JSON.parse(await readOnly.execute('list_items')).length, 1)
      await assert.rejects(readOnly.execute('delete_item', { id: itemId }), /disabled/)
      await assert.rejects(restricted.execute('delete_item', { id: itemId }), /cannot modify/)
      await assert.rejects(writer.execute('update_item', { id: itemId, updates: { created_by: viewer } }), /Invalid MCP/)
      const result = await writer.execute('create_item', { item_name: 'MCP item', item_type: 'material', quantity: 1, unit_price: 12.5 })
      const item = JSON.parse(result.slice(result.indexOf('\n') + 1))
      assert.equal(item.unit_price, 12.5)
      assert.equal(item.created_by, actor)
      await writer.execute('update_item', { id: item.id, updates: { quantity: 3 } })
      assert.equal(JSON.parse(await writer.execute('get_item', { id: item.id })).quantity, 3)
      await writer.execute('delete_item', { id: item.id })
      await assert.rejects(writer.execute('get_item', { id: item.id }), /not found/)
      assert.equal((await ownerPool.query('select user_id from public.audit_logs where target_id=$1', [item.id])).rows.every(row => row.user_id === actor), true)
      await ownerPool.query('update public.profiles set is_active=false where id=$1', [viewer])
      await assert.rejects(restricted.execute('list_items'), /missing or inactive/)
      const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/mcp-server.ts'], { env: { ...mcpEnv, DATA_BACKEND: 'postgres', CAMMS_MCP_ALLOW_WRITE: 'false' }, stdio: ['pipe', 'pipe', 'pipe'] })
      let output = ''; let errors = ''
      child.stdout.on('data', chunk => { output += chunk })
      child.stderr.on('data', chunk => { errors += chunk })
      child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_items', arguments: {} } }) + '\n')
      const [code] = await once(child, 'exit')
      assert.equal(code, 0, errors)
      const response = JSON.parse(output.trim())
      assert.equal(response.error, undefined, output)
      assert.equal(JSON.parse(response.result.content[0].text).length, 1)
    } finally { await Promise.all([readOnly.close(), writer.close(), restricted.close()]) }
  } finally {
    await Promise.all(fixturePools.map(pool => pool.end()))
    if (created) {
      assert.match(databaseName, /^camms_verify_[a-f0-9]{32}$/)
      assert.notEqual(databaseName, new URL(env.DATABASE_MIGRATION_URL).pathname.slice(1))
      await adminPool.query(`drop database "${databaseName}"`)
    }
    await adminPool.end()
  }
})
