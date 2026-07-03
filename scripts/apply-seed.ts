// scripts/apply-seed.ts
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Error: Missing required environment variables')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const userClient = createClient(supabaseUrl, supabaseAnonKey)

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarQuote = false

  const lines = sql.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase()
    if (trimmed === 'BEGIN;' || trimmed === 'COMMIT;' || trimmed === 'ROLLBACK;') {
      continue
    }
    current += line + '\n'
    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote
    }
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
  const tempEmail = `temp_seed_${Date.now()}@example.com`
  const tempPassword = `TempPassword_${Date.now()}!23`
  let tempUserId: string | null = null

  try {
    console.log('1. Creating temporary admin user for seeding...')
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

    console.log('Authentication successful! Applying seed.sql...')
    const seedPath = path.join(process.cwd(), 'db', 'seed.sql')
    const rawSql = fs.readFileSync(seedPath, 'utf8')
    const statements = splitSqlStatements(rawSql)

    console.log(`Split seed.sql into ${statements.length} SQL statements.`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const { data: rpcRes, error: rpcError } = await userClient.rpc('exec_admin_sql', {
        sql_query: stmt
      })

      if (rpcError) {
        throw new Error(`RPC call failed for statement ${i + 1}: ${rpcError.message}`)
      }

      const res = rpcRes as { ok: boolean; error?: string }
      if (!res.ok) {
        throw new Error(`Statement ${i + 1} failed: ${res.error}\nStatement was:\n${stmt}`)
      }
    }

    console.log('seed.sql applied successfully!')
  } catch (err) {
    console.error('Seeding failed:', err)
  } finally {
    if (tempUserId) {
      console.log('Cleaning up temporary seeding user...')
      await adminClient.auth.admin.deleteUser(tempUserId)
      console.log('Temporary seeding user deleted.')
    }
  }
}

main()
