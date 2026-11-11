import { Pool } from 'pg'

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('Set DATABASE_URL or DATABASE_MIGRATION_URL before checking PostgreSQL readiness.')
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000, max: 1 })
  try {
    await pool.query('select 1')
    const tables = await pool.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) and c.relrowsecurity", [['profiles', 'items', 'categories', 'locations', 'units', 'audit_logs']])
    if (tables.rows.length !== 6) throw new Error('PostgreSQL registry tables or row level security are incomplete.')
    console.log('PostgreSQL readiness passed: connection, registry tables, and row level security are available.')
  } finally { await pool.end() }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
