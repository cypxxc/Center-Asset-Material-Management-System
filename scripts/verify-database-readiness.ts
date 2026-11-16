import { Pool } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function getReadinessConnectionString(env: NodeJS.ProcessEnv = process.env, directory = process.cwd()) {
  const merged = { ...env }
  config({ path: [resolve(directory, '.env.local'), resolve(directory, '.env')], processEnv: merged, quiet: true })
  const connectionString = merged.DATABASE_MIGRATION_URL || merged.DATABASE_URL
  if (!connectionString) throw new Error('Set DATABASE_URL or DATABASE_MIGRATION_URL before checking PostgreSQL readiness.')
  return connectionString
}

async function main() {
  const connectionString = getReadinessConnectionString()
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000, max: 1 })
  try {
    await pool.query('select 1')
    const tables = await pool.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) and c.relrowsecurity", [['profiles', 'items', 'categories', 'locations', 'units', 'audit_logs']])
    if (tables.rows.length !== 6) throw new Error('PostgreSQL registry tables or row level security are incomplete.')
    console.log('PostgreSQL readiness passed: connection, registry tables, and row level security are available.')
  } finally { await pool.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
