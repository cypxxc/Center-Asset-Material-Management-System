import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const requiredMigrations = [
  '00026_atomic_database_restore.sql',
  '00027_lock_down_admin_sql.sql',
  '00028_revoke_authenticated_admin_sql.sql',
  '00029_harden_profile_role_defaults.sql',
  '00030_revoke_anon_admin_sql.sql',
  '00031_lock_down_public_report_rpcs.sql',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Database readiness requires Supabase URL and service-role key')

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const query = async (sqlQuery: string) => {
    const { data, error } = await client.rpc('exec_admin_sql', { sql_query: sqlQuery })
    if (error) throw new Error(error.message)
    const result = data as { ok?: boolean; error?: string; rows?: Record<string, unknown>[] }
    if (!result.ok) throw new Error(result.error ?? 'Database readiness query failed')
    return result.rows ?? []
  }

  const failures: string[] = []
  const ledgerRows = await query("select to_regclass('public.app_migrations') is not null as ledger_exists")
  const ledgerExists = ledgerRows[0]?.ledger_exists === true
  if (!ledgerExists) {
    failures.push('migration ledger is missing (apply migrations 00029-00031)')
    for (const migration of requiredMigrations) failures.push(`unverified migration: ${migration}`)
  } else {
    const migrations = await query('select migration from public.app_migrations order by migration')
    const applied = new Set(migrations.map((row) => String(row.migration)))
    for (const migration of requiredMigrations) {
      if (!applied.has(migration)) failures.push(`missing migration: ${migration}`)
    }
  }

  const rlsRows = await query(`select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('profiles','categories','locations','units','items','audit_logs')`)
  for (const row of rlsRows) {
    if (!row.rls_enabled) failures.push(`RLS disabled: ${String(row.table_name)}`)
  }
  if (rlsRows.length !== 6) failures.push('one or more registry tables are missing from the public schema')

  const aclRows = await query(`select p.proname,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      coalesce((select bool_or(acl.grantee = 0 and acl.privilege_type = 'EXECUTE')
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl), false) as public_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('exec_admin_sql','get_report_items_page','get_report_stats','get_sidebar_stats','import_items_bulk_tx','restore_database_backup')`)
  for (const row of aclRows) {
    if (row.anon_execute || row.public_execute) {
      failures.push(`unsafe execute grant: ${String(row.proname)}`)
    }
  }
  if (aclRows.length !== 6) failures.push('one or more required release RPCs are missing')

  if (failures.length > 0) throw new Error(`Database release readiness failed:\n- ${failures.join('\n- ')}`)
  console.log('Database release readiness passed: migrations, RLS, and RPC grants are safe.')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
