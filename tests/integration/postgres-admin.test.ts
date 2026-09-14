import '../setup/dom'
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { backupTables, parseBusinessBackup, writablePayload } from '../../features/admin/postgres-policy'

const actor = '11111111-1111-4111-8111-111111111111'
const target = '22222222-2222-4222-8222-222222222222'
let profile: { id: string; role: string; is_active: boolean } | null = { id: actor, role: 'admin', is_active: true }
const queries: { sql: string; params: unknown[] }[] = []
let privilegedConnections = 0
let commits = 0
let rollbacks = 0
let failOn = ''
let rowResult: Record<string, unknown>[] = [{ id: target }]
let actorStillActive = true
function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
const tx = { execute: async (query: SQL) => {
  const statement = new PgDialect().sqlToQuery(query)
  queries.push(statement)
  if (failOn && statement.sql.includes(failOn)) throw new Error('Failed query: secret-hash', { cause: new Error('connection terminated') })
  if (statement.sql.includes('for share')) return { rows: actorStillActive ? [{ id: actor }] : [] }
  return { rows: rowResult }
} }
async function transaction<T>(work: (value: typeof tx) => Promise<T>) {
  try { const value = await work(tx); commits++; return value } catch (error) { rollbacks++; throw error }
}
mockModule('../../features/auth/queries', { getCurrentProfile: async () => profile })
mockModule('../../lib/postgres/request', { withUserDatabase: transaction })
mockModule('../../lib/postgres/db', { getAuthDatabase: () => { privilegedConnections++; return { transaction } } })
mockModule('../../lib/postgres/password', { hashPassword: async () => 'secret-hash' })
const actions = import('../../features/admin/postgres-admin')
function backup() {
  return { __meta: { version: 1 }, ...Object.fromEntries(backupTables.map(table => [table, []])) } as Record<string, unknown>
}
afterEach(() => {
  profile = { id: actor, role: 'admin', is_active: true }
  queries.length = 0; privilegedConnections = 0; commits = 0; rollbacks = 0; failOn = ''; actorStillActive = true
  rowResult = [{ id: target }]
})

test('every administrative surface denies untrusted users before privileged access', async () => {
  const admin = await actions
  for (const denied of [null, { id: actor, role: 'staff', is_active: true }, { id: actor, role: 'admin', is_active: false }]) {
    profile = denied
    const results = await Promise.all([
      admin.pgGetTableData('items'), admin.pgDeleteTableRow('items', target),
      admin.pgCreateAuthUser({ full_name: 'User', password: 'password', role: 'staff', is_active: true }),
      admin.pgDeleteAuthUser(target), admin.pgResetAuthPassword(target, 'password'),
      admin.pgUpdateUserEmail(target, 'user@example.com'), admin.pgUpdateUserProfile(target, { role: 'staff' }),
      admin.pgExportDatabaseData(), admin.pgImportDatabaseData(JSON.stringify(backup())),
      admin.pgGetProfilesList({}), admin.pgGetAuditLogsList({}), admin.pgUpsertTableRow('items', target, { item_name: 'Item' }),
    ])
    for (const result of results) assert.match('error' in result ? result.error ?? '' : '', /Admin role required/)
  }
  assert.equal(privilegedConnections, 0)
  assert.equal(queries.length, 0)
})

test('authority is rechecked under a lock before account writes', async () => {
  actorStillActive = false
  const result = await (await actions).pgUpdateUserProfile(target, { role: 'admin' })
  assert.match(result.error ?? '', /Admin role required/)
  assert.equal(commits, 0)
  assert.equal(rollbacks, 1)
  assert.ok(queries.every(query => !query.sql.startsWith('update')))
})

test('password reset atomically revokes sessions and records only the event', async () => {
  const result = await (await actions).pgResetAuthPassword(target, 'new-password')
  assert.equal(result.success, true)
  assert.equal(commits, 1)
  const reset = queries.findIndex(query => query.sql.startsWith('update private_auth.credentials'))
  assert.match(queries[reset - 1].sql, /public.profiles .*for update/)
  assert.match(queries[reset + 1].sql, /delete from private_auth.sessions/)
  assert.match(queries[reset + 2].sql, /private_auth.record_admin_event/)
  assert.ok(!queries[reset + 2].params.includes('secret-hash'))
  assert.ok(!JSON.stringify(result).includes('secret-hash'))
})

test('account creation failure rolls back and does not expose the failing SQL or hash', async () => {
  failOn = 'insert into private_auth.credentials'
  const result = await (await actions).pgCreateAuthUser({ email: 'USER@example.com', full_name: 'User', password: 'password', role: 'staff', is_active: true })
  assert.ok(result.error)
  assert.ok(!result.error.includes('secret-hash'))
  assert.equal(commits, 0)
  assert.equal(rollbacks, 1)
  assert.ok(queries.some(query => query.params.includes('user@example.com')))
})

test('administrators cannot remove their own access through any profile write', async () => {
  const admin = await actions
  for (const result of [await admin.pgDeleteAuthUser(actor), await admin.pgUpdateUserProfile(actor, { role: 'viewer' }), await admin.pgUpsertTableRow('profiles', actor, { is_active: false })]) assert.ok(result.error)
  assert.equal(commits, 0)
  assert.ok(queries.every(query => !/^(delete|update)/.test(query.sql)))
})

test('restore replaces only business tables and safely resolves historical account references', async () => {
  const data = backup()
  data.items = [{ id: target, created_by: actor }]
  assert.equal((await (await actions).pgImportDatabaseData(JSON.stringify(data))).success, true)
  assert.equal(commits, 1)
  assert.match(queries[1].sql, /lock table .*share row exclusive mode/)
  const deletes = queries.filter(query => query.sql.startsWith('delete'))
  assert.equal(deletes.length, 4)
  assert.ok(deletes.every(query => !/profiles|audit_logs|private_auth/.test(query.sql)))
  const insert = queries.find(query => query.sql.startsWith('insert into "public"."items"'))!
  for (const key of ['created_by', 'updated_by', 'deleted_by']) assert.ok(insert.sql.includes(`select id from public.profiles where id = "restored"."${key}"`))
  assert.match(queries.at(-1)!.sql, /backup_restore/)
})

test('restore stops and rolls back when a business row fails', async () => {
  const data = backup()
  data.items = [{ id: target }]
  failOn = 'insert into "public"."items"'
  const result = await (await actions).pgImportDatabaseData(JSON.stringify(data))
  assert.ok(result.error)
  assert.equal(commits, 0)
  assert.equal(rollbacks, 1)
  assert.ok(queries.every(query => !query.sql.includes('backup_restore')))
})

test('backup export uses one snapshot and excludes authentication secrets', async () => {
  rowResult = [backup()]
  const result = await (await actions).pgExportDatabaseData()
  assert.ok(result.backup)
  assert.equal(queries.length, 2)
  assert.equal(commits, 1)
  for (const table of backupTables) assert.ok(queries[1].sql.includes(`"public"."${table}"`))
  assert.ok(!/credentials|sessions|password/.test(queries[1].sql))
})

test('audit filters match trigger casing and parameterize hostile search input', async () => {
  await (await actions).pgGetAuditLogsList({ action: 'INSERT', q: "';drop table items;--" })
  assert.ok(queries[1].sql.includes('lower(a.action)'))
  assert.ok(queries[1].params.includes('insert'))
  assert.ok(!queries[1].sql.includes('drop table'))
})

test('backup and table policies reject credentials, SQL identifiers and injected columns', () => {
  for (const table of ['credentials', 'private_auth.sessions', 'items;drop table items']) assert.throws(() => writablePayload(table, { item_name: 'test' }))
  assert.throws(() => writablePayload('audit_logs', { action: 'DELETE' }))
  assert.throws(() => writablePayload('profiles', { email: 'user@example.com' }))
  assert.throws(() => parseBusinessBackup(JSON.stringify({ ...backup(), credentials: [] })))
  assert.throws(() => parseBusinessBackup(JSON.stringify({ ...backup(), items: [{ id: target, password_hash: 'test' }] })))
})
