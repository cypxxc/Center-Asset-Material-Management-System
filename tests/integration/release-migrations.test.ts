import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration29 = readFileSync('db/migrations/00029_harden_profile_role_defaults.sql', 'utf8')
const migration30 = readFileSync('db/migrations/00030_revoke_anon_admin_sql.sql', 'utf8')
const migration31 = readFileSync('db/migrations/00031_lock_down_public_report_rpcs.sql', 'utf8')
const migration32 = readFileSync('db/migrations/00032_public_storage_read_policy.sql', 'utf8')
const restoreMigration = readFileSync('db/migrations/00026_atomic_database_restore.sql', 'utf8')
const importMigration = readFileSync('db/migrations/00024_remove_archive_and_add_unit_price.sql', 'utf8')

test('release migrations record the required migration ledger entries', () => {
  assert.match(migration29, /CREATE TABLE IF NOT EXISTS public\.app_migrations/i)
  for (const id of ['00026_', '00027_', '00028_', '00029_']) assert.match(migration29, new RegExp(id))
  assert.match(migration30, /00030_revoke_anon_admin_sql\.sql/)
  assert.match(migration31, /00031_lock_down_public_report_rpcs\.sql/)
})

test('report RPCs use invoker security and explicitly reject public execution', () => {
  for (const name of ['get_report_items_page', 'get_report_stats', 'get_sidebar_stats']) {
    assert.match(migration31, new RegExp(`ALTER FUNCTION public\\.${name}\\([^;]*SECURITY INVOKER`, 'is'))
    assert.match(migration31, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}`))
  }
})

test('migration 00032 grants public read policy for item-images storage bucket', () => {
  assert.match(migration32, /create policy "Allow public to read item images"/i)
  assert.match(migration32, /on storage\.objects for select/i)
  assert.match(migration32, /to public/i)
  assert.match(migration32, /bucket_id = 'item-images'/i)
})

test('privileged mutating RPCs retain internal authorization and minimum grants', () => {
  assert.match(restoreMigration, /auth\.uid\(\) IS NULL OR private\.current_app_role\(\) <> 'admin'/)
  assert.match(importMigration, /caller_role NOT IN \('admin', 'staff'\)/)
  for (const sql of [migration30, migration31]) {
    assert.match(sql, /FROM PUBLIC/)
    assert.match(sql, /FROM anon/)
  }
})
