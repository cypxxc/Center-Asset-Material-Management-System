import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { hashPassword } from '../lib/postgres/password'

const ALLOWED_E2E_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALLOWED_E2E_DB_PATTERN = /^\/camms_(registry|staging|e2e_[a-z0-9_]+)$/

export function assertIsolatedE2EDatabase(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env
): URL {
  if (env.CAMMS_ALLOW_E2E_DB_SEED !== 'true') {
    throw new Error('Refusing E2E fixture provisioning without CAMMS_ALLOW_E2E_DB_SEED=true')
  }
  const url = new URL(connectionString)
  if (!ALLOWED_E2E_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing E2E fixture provisioning on non-local host: ${url.hostname}`)
  }
  if (!ALLOWED_E2E_DB_PATTERN.test(url.pathname)) {
    throw new Error(`Refusing E2E fixture provisioning on non-E2E database: ${url.pathname}`)
  }
  return url
}

function resolveMigrationConnectionString(env: NodeJS.ProcessEnv): string {
  if (env.DATABASE_MIGRATION_URL?.trim()) return env.DATABASE_MIGRATION_URL.trim()
  if (existsSync('.env.postgres.app')) {
    const parsed = parse(readFileSync('.env.postgres.app'))
    if (parsed.DATABASE_MIGRATION_URL?.trim()) return parsed.DATABASE_MIGRATION_URL.trim()
  }
  throw new Error('DATABASE_MIGRATION_URL is required for E2E fixture provisioning')
}

async function ensureUserWithCredential(
  client: { query: Pool['query'] },
  email: string,
  fullName: string,
  role: 'admin' | 'user',
  password: string | undefined
) {
  const existing = await client.query<{ id: string; role: string; is_active: boolean }>(
    'SELECT id, role, is_active FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1',
    [email]
  )
  let userId = existing.rows[0]?.id
  if (!userId) {
    if (!password) {
      throw new Error(`Missing password environment variable to provision E2E user ${email}`)
    }
    const inserted = await client.query<{ id: string }>(
      'INSERT INTO public.profiles (full_name, email, role, is_active) VALUES ($1, $2, $3, true) RETURNING id',
      [fullName, email, role]
    )
    userId = inserted.rows[0].id
  } else if (!existing.rows[0].is_active) {
    await client.query('UPDATE public.profiles SET is_active = true WHERE id = $1', [userId])
  }

  const cred = await client.query(
    'SELECT 1 FROM private_auth.credentials WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  if (!cred.rowCount) {
    if (!password) {
      throw new Error(`Missing password environment variable to provision credentials for ${email}`)
    }
    const hash = await hashPassword(password)
    await client.query(
      'INSERT INTO private_auth.credentials (user_id, password_hash) VALUES ($1, $2)',
      [userId, hash]
    )
  }
}

export async function ensureE2EFixtures(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.CAMMS_E2E_REAL_AUTH !== 'true') return

  const connectionString = resolveMigrationConnectionString(env)
  assertIsolatedE2EDatabase(connectionString, env)

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 })
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('camms-e2e-fixtures'))")

      const adminEmail = env.CAMMS_E2E_ADMIN_ID?.trim() || 'admin@camms.local'
      await ensureUserWithCredential(
        client,
        adminEmail,
        'ผู้ดูแลระบบ',
        'admin',
        env.CAMMS_E2E_ADMIN_PASSWORD
      )

      if (env.CAMMS_E2E_STAFF_PASSWORD) {
        const staffEmail = env.CAMMS_E2E_STAFF_ID?.trim() || 'staff@registry.s'
        await ensureUserWithCredential(
          client,
          staffEmail,
          'Staff E2E',
          'admin',
          env.CAMMS_E2E_STAFF_PASSWORD
        )
      }

      const unit = await client.query<{ id: string; is_active: boolean }>(
        "SELECT id, is_active FROM public.units WHERE name = 'เครื่อง' LIMIT 1"
      )
      if (!unit.rows[0]) {
        await client.query("INSERT INTO public.units (name, is_active) VALUES ('เครื่อง', true)")
      } else if (!unit.rows[0].is_active) {
        await client.query('UPDATE public.units SET is_active = true WHERE id = $1', [unit.rows[0].id])
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}
