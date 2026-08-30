import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  buildAtomicMigrationSql,
  parseRequestedMigrations,
  splitSqlStatements,
  validateAvailableMigrationNumbers,
  validateMigrationOrder,
} from './migration-utils'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const available = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  const requested = parseRequestedMigrations(process.env.MIGRATION_FILES)
  validateAvailableMigrationNumbers(available)
  validateMigrationOrder(requested, available)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`Applying ${requested.length} explicitly selected migrations: ${requested.join(', ')}`)
  for (const file of requested) {
    const statements = splitSqlStatements(fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    console.log(`Applying ${file} (${statements.length} statements)`)
    const atomicSql = buildAtomicMigrationSql(statements)

    const { data, error } = await adminClient.rpc('exec_admin_sql', { sql_query: atomicSql })
    if (error) throw new Error(`${file}: ${error.message}`)

    const result = data as { ok?: boolean; error?: string }
    if (!result?.ok) {
      throw new Error(`${file}: ${result?.error ?? 'unknown migration error'}`)
    }
    console.log(`Applied ${file}`)
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
