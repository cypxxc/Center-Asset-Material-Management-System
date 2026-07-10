// scripts/apply-migrations.ts
// Automates running migrations on Supabase using the exec_admin_sql RPC.

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Error: Missing required environment variables in .env or .env.local')
  process.exit(1)
}

// Service role client
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Anon client for user session
const userClient = createClient(supabaseUrl, supabaseAnonKey)

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarQuote = false

  const lines = sql.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase()
    if (
      trimmed === 'BEGIN;' ||
      trimmed === 'COMMIT;' ||
      trimmed === 'ROLLBACK;'
    ) {
      continue
    }

    current += line + '\n'

    // Simple toggling of dollar quote block
    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote
    }

    // Split on semicolon outside dollar quotes
    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }

  if (current.trim()) {
    statements.push(current.trim())
  }

  return statements.filter(s => s.length > 0)
}

async function main() {
  const requestedFiles = process.env.MIGRATION_FILES
    ?.split(',')
    .map((file) => file.trim())
    .filter(Boolean)

  if (!requestedFiles || requestedFiles.length === 0) {
    throw new Error('MIGRATION_FILES is required. Pass an explicit comma-separated migration list.')
  }

  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
  const missingFiles = requestedFiles.filter((file) => !files.includes(file))
  if (missingFiles.length > 0) {
    throw new Error(`Migration files not found: ${missingFiles.join(', ')}`)
  }

  const tempEmail = `temp_migrate_${Date.now()}@example.com`
  const tempPassword = `TempPassword_${Date.now()}!23`
  let tempUserId: string | null = null

  try {
    console.log('1. Creating temporary migration admin user...')
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true
    })

    if (authError || !authData?.user) {
      throw new Error(`Failed to create temp admin auth: ${authError?.message}`)
    }

    tempUserId = authData.user.id
    console.log(`Temporary User Created: ${tempUserId}`)

    console.log('2. Elevating temporary user role to admin...')
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', tempUserId)

    if (profileError) {
      throw new Error(`Failed to elevate role to admin: ${profileError.message}`)
    }

    console.log('3. Authenticating user session...')
    const { data: sessionData, error: signInError } = await userClient.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword
    })

    if (signInError || !sessionData?.session) {
      throw new Error(`Failed to sign in temp admin: ${signInError?.message}`)
    }

    console.log('Authentication successful!')

    const pendingMigrations = files.filter((file) => requestedFiles.includes(file))

    console.log(`Found ${pendingMigrations.length} migrations to apply:`, pendingMigrations)

    for (const file of pendingMigrations) {
      console.log(`\nApplying migration: ${file}...`)
      const filePath = path.join(migrationsDir, file)
      const rawSql = fs.readFileSync(filePath, 'utf8')
      const statements = splitSqlStatements(rawSql)

      console.log(`Split ${file} into ${statements.length} SQL statements.`)

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        const migrationNumber = parseInt(file.split('_')[0], 10)
        const migrationClient = migrationNumber >= 28 ? adminClient : userClient
        const { data: rpcRes, error: rpcError } = await migrationClient.rpc('exec_admin_sql', {
          sql_query: stmt
        })

        if (rpcError) {
          throw new Error(`RPC call failed for ${file} statement ${i + 1}: ${rpcError.message}`)
        }

        const res = rpcRes as { ok: boolean; error?: string }
        if (!res.ok) {
          throw new Error(`Migration ${file} statement ${i + 1} failed: ${res.error}\nStatement was:\n${stmt}`)
        }
      }

      console.log(`Successfully applied all statements in ${file}!`)
    }

    console.log('\nAll pending migrations applied successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    if (tempUserId) {
      console.log('\n4. Cleaning up temporary migration user...')
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(tempUserId)
      if (deleteError) {
        console.error(`Failed to delete temporary user ${tempUserId}:`, deleteError.message)
      } else {
        console.log('Temporary migration user deleted successfully.')
      }
    }
  }
}

main()
