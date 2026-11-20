import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { readMigrationFiles } from 'drizzle-orm/migrator'

test('distribution contains a single final baseline and matching metadata', () => {
  const folder = 'db/postgres/migrations'
  const sqlFiles = readdirSync(folder).filter(name => name.endsWith('.sql'))
  assert.deepEqual(sqlFiles, ['0000_final_schema.sql'])
  const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8'))
  assert.equal(journal.entries.length, sqlFiles.length)
  assert.equal(journal.entries[0].idx, 0)
  assert.equal(journal.entries[0].tag, '0000_final_schema')
  assert.equal(journal.entries[0].when, 1795104000002)
  assert.deepEqual(readdirSync(`${folder}/meta`).sort(), ['0000_snapshot.json', '_journal.json'])
  const snapshot = JSON.parse(readFileSync(`${folder}/meta/0000_snapshot.json`, 'utf8'))
  assert.equal(snapshot.prevId, '00000000-0000-0000-0000-000000000000')
  assert.equal(snapshot.tables['public.profiles'].columns.email.notNull, false)
  assert.equal(Object.keys(snapshot.tables).length, 21)
  const migrations = readMigrationFiles({ migrationsFolder: folder })
  assert.equal(migrations.length, sqlFiles.length)
  const sql = migrations[0].sql.join('\n')
  for (const table of ['profiles', 'items', 'disbursements', 'disbursement_items', 'stock_movements', 'asset_custody_logs']) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(`))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
  }
  assert.match(sql, /CREATE FUNCTION private\.current_app_role/)
  assert.match(sql, /CREATE FUNCTION public\.protect_disbursement/)
  assert.match(sql, /disbursement_items_document_item_unique/)
  assert.match(sql, /GRANT .* TO camms_auth/)
  assert.doesNotMatch(sql, /\\(?:un)?restrict|COPY .* FROM stdin|__drizzle_migrations/)
  assert.match(sql, /CREATE FUNCTION private\.apply_asset_custody_event/)
  assert.doesNotMatch(sql, /private\.record_asset_custody_event/)
  assert.ok(snapshot.tables['public.items'].columns.custody_revision)
  assert.ok(snapshot.tables['public.asset_custody_logs'].columns.custody_origin_verified)
})
