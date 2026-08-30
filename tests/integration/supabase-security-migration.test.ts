import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadSecurityMigration() {
  const migrationsDirectory = join(process.cwd(), 'db', 'migrations')
  const matches = readdirSync(migrationsDirectory)
    .filter((file) => /^\d{14}_harden_profiles_bulk_import_audit\.sql$/.test(file))

  assert.equal(
    matches.length,
    1,
    'Expected one Supabase CLI timestamped harden_profiles_bulk_import_audit migration',
  )

  return readFileSync(join(migrationsDirectory, matches[0]), 'utf8')
}

describe('Supabase security remediation migration', () => {
  test('limits active self-service profile updates to full_name and sidebar_order', () => {
    const sql = loadSecurityMigration()

    assert.match(sql, /REVOKE UPDATE ON TABLE public\.profiles FROM authenticated/i)
    assert.match(sql, /GRANT UPDATE \(full_name, sidebar_order\) ON TABLE public\.profiles TO authenticated/i)
    assert.match(sql, /GRANT UPDATE ON TABLE public\.profiles TO service_role/i)
    assert.match(sql, /CREATE POLICY profiles_update_own[\s\S]*FOR UPDATE TO authenticated/i)
    assert.match(sql, /USING \([\s\S]*id = \(SELECT auth\.uid\(\)\)[\s\S]*private\.current_app_role\(\) IS NOT NULL[\s\S]*\)/i)
    assert.match(sql, /WITH CHECK \([\s\S]*id = \(SELECT auth\.uid\(\)\)[\s\S]*private\.current_app_role\(\) IS NOT NULL[\s\S]*\)/i)
  })

  test('rejects inactive bulk import callers while preserving role and creator constraints', () => {
    const sql = loadSecurityMigration()

    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.import_items_bulk_tx\([\s\S]*SECURITY DEFINER/i)
    assert.match(sql, /FROM public\.profiles[\s\S]*id = \(SELECT auth\.uid\(\)\)[\s\S]*is_active = true/i)
    assert.match(sql, /caller_role NOT IN \('admin', 'staff'\)/i)
    assert.match(sql, /creator_id IS DISTINCT FROM \(SELECT auth\.uid\(\)\)[\s\S]*caller_role <> 'admin'/i)
    assert.match(sql, /unit_price_val numeric\(12,2\)/i)
    assert.match(sql, /item_type_val NOT IN \('asset', 'material'\)/i)
    assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.import_items_bulk_tx\(json, uuid\) FROM PUBLIC, anon/i)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.import_items_bulk_tx\(json, uuid\) TO authenticated/i)
  })

  test('restores immutable audit logs and automatic coverage while leaving service operations to semantic app logs', () => {
    const sql = loadSecurityMigration()

    assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.audit_logs/i)
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.process_audit_log_event\(\)[\s\S]*SECURITY INVOKER/i)
    assert.match(sql, /IF v_user_id IS NULL THEN[\s\S]*RETURN NULL/i)
    assert.doesNotMatch(sql, /current_user = 'authenticated'/i)
    assert.match(sql, /v_target_id uuid/i)

    for (const table of ['items', 'categories', 'locations', 'units', 'profiles']) {
      assert.match(sql, new RegExp(`AFTER INSERT OR UPDATE OR DELETE ON public\\.${table}`, 'i'))
    }
  })
})
