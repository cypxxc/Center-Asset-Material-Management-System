import { Pool } from 'pg'
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'

/** Read-only probe. Connect as the restricted runtime role, never the migration owner. */
export async function verifyDisbursementBackend(connectionString: string): Promise<{ compatible: boolean; missing: string[] }> {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 10000 })
  try {
    const missing: string[] = []
    const role = await pool.query<{ unsafe: boolean }>('SELECT rolsuper OR rolbypassrls AS unsafe FROM pg_roles WHERE rolname = current_user')
    if (role.rows[0]?.unsafe !== false) missing.push('restricted runtime role (NOSUPERUSER NOBYPASSRLS)')
    for (const table of ['profiles', 'items', 'disbursements', 'disbursement_items', 'asset_custody_logs', 'audit_logs']) {
      const result = await pool.query<{ present: boolean; rls: boolean }>('SELECT c.oid IS NOT NULL AS present, coalesce(c.relrowsecurity,false) AS rls FROM (SELECT to_regclass($1) AS oid) ref LEFT JOIN pg_class c ON c.oid = ref.oid', [`public.${table}`])
      if (!result.rows[0]?.present) missing.push(`table public.${table}`)
      else if (!result.rows[0].rls) missing.push(`RLS public.${table}`)
    }
    for (const fn of ['private.current_user_id()', 'private.current_app_role()']) {
      const result = await pool.query<{ present: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS present', [fn])
      if (!result.rows[0]?.present) missing.push(fn)
    }
    const index = await pool.query<{ present: boolean }>("SELECT to_regclass('public.disbursement_items_document_item_unique') IS NOT NULL AS present")
    if (!index.rows[0]?.present) missing.push('migration 0018 grouped integrity')
    return { compatible: missing.length === 0, missing }
  } finally { await pool.end() }
}

async function main() {
  const local = existsSync('.env.local') ? parse(readFileSync('.env.local')) : {}
  const targets = [
    ['standalone', process.env.DISBURSEMENT_POSTGRES_TEST_URL || process.env.DATABASE_URL || local.DATABASE_URL],
    ['supabase-postgres', process.env.DISBURSEMENT_SUPABASE_TEST_URL],
  ] as const
  for (const [name, url] of targets) {
    if (!url) { console.log(`${name}: UNVERIFIED (connection not configured)`); continue }
    try {
      const result = await verifyDisbursementBackend(url)
      console.log(`${name}: ${result.compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}${result.missing.length ? `: ${result.missing.join(', ')}` : ''}`)
      if (!result.compatible) process.exitCode = 1
    } catch {
      // Driver errors may contain connection strings or credentials. Do not print them.
      console.log(`${name}: verification failed; check connection and restricted role/schema prerequisites`)
      process.exitCode = 1
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
