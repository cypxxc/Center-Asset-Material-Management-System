import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { localPostgresConfig } from './postgres-local-config'
import { checkLocalPostgres } from './postgres-local-connection'
import { migratePostgres } from './postgres-migrate'
import { hashPassword } from '../lib/postgres/password'

const appFile = '.env.postgres.app'
const credentialsFile = '.env.postgres.admin'
const database = 'camms_registry'
const secret = () => randomBytes(32).toString('hex')
function writeEnv(file: string, values: Record<string, string>) {
  writeFileSync(file, Object.entries(values).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' })
}
async function setup() {
  const local = localPostgresConfig(parse(readFileSync('.env.postgres.local')))
  await checkLocalPostgres(local.connectionString)
  const owner = new Pool({ connectionString: local.connectionString, connectionTimeoutMillis: 5000 })
  let app: Record<string,string>
  try {
    if (!existsSync(appFile)) {
      const base = new URL(local.connectionString)
      base.pathname = `/${database}`
      const migrationUrl = base.toString()
      base.username = 'camms_app'; base.password = secret()
      const runtimeUrl = base.toString()
      base.username = 'camms_auth'; base.password = secret()
      app = { DATA_BACKEND: 'postgres', NEXT_PUBLIC_DATA_BACKEND: 'postgres', DATABASE_URL: runtimeUrl, DATABASE_AUTH_URL: base.toString(), DATABASE_MIGRATION_URL: migrationUrl, LOCAL_STORAGE_PATH: './.local-storage' }
      writeEnv(appFile, app)
    } else { app = parse(readFileSync(appFile)) }
    if (new URL(app.DATABASE_MIGRATION_URL).pathname !== `/${database}`) throw new Error('Unexpected application database')
    for (const [name, connection] of [['camms_app',app.DATABASE_URL],['camms_auth',app.DATABASE_AUTH_URL]]) {
      const password = decodeURIComponent(new URL(connection).password)
      if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Unexpected role password format')
      const role = await owner.query('select 1 from pg_roles where rolname=$1',[name])
      if (!role.rowCount) {
        // Both role names and password alphabet are fixed/validated above; PostgreSQL DDL cannot bind these tokens.
        await owner.query(`CREATE ROLE "${name}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${password}'`)
      }
    }
    const existing = await owner.query('select 1 from pg_database where datname=$1',[database])
    if (!existing.rowCount) {
      const ownerEndpoint = new URL(local.connectionString)
      const migrationEndpoint = new URL(app.DATABASE_MIGRATION_URL)
      if (migrationEndpoint.hostname !== ownerEndpoint.hostname ||
          (migrationEndpoint.port || '5432') !== (ownerEndpoint.port || '5432')) {
        throw new Error('Fresh database and migration connections must target the same PostgreSQL endpoint')
      }
      await owner.query('CREATE DATABASE camms_registry')
    }
  } finally { await owner.end() }
  const migrationPool = new Pool({ connectionString: app!.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  try {
    await migratePostgres(migrationPool)
    const client = await migrationPool.connect()
    let starter: { email: string; password: string } | undefined
    try {
      await client.query('BEGIN')
      await client.query("select pg_advisory_xact_lock(hashtext('camms-initial-admin'))")
      const count = await client.query('select count(*)::int as count from public.profiles')
      if (count.rows[0].count === 0) {
        if (!existsSync(credentialsFile)) writeEnv(credentialsFile, { INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@camms.local', INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || secret() })
        const initial = parse(readFileSync(credentialsFile))
        const hash = await hashPassword(initial.INITIAL_ADMIN_PASSWORD)
        const result = await client.query("insert into public.profiles(full_name,email,role) values('ผู้ดูแลระบบ',$1,'admin') returning id", [initial.INITIAL_ADMIN_EMAIL])
        await client.query('insert into private_auth.credentials(user_id,password_hash) values($1,$2)', [result.rows[0].id,hash])
        starter = { email: initial.INITIAL_ADMIN_EMAIL, password: initial.INITIAL_ADMIN_PASSWORD }
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    if (starter) {
      console.log('[postgres:app:setup] Created starter account (administrator).')
      console.log(`  Email: ${starter.email}`)
      if (process.stdout.isTTY && !process.env.CI) console.log(`  Password: ${starter.password}`)
      console.log(`  Credentials file: ${credentialsFile} (INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD)`)
    } else {
      console.log('[postgres:app:setup] Existing accounts retained. Starter account creation skipped.')
    }
    mkdirSync(app!.LOCAL_STORAGE_PATH,{ recursive:true })
    console.log(`[postgres:app:setup] Database ${database}, roles camms_app and camms_auth, migrations, and local storage are ready.`)
  } finally { await migrationPool.end() }
}
async function setupUser() {
  const email = 'user@camms.local'
  const userCredentialsFile = '.env.postgres.user'
  const app = existsSync(appFile) ? parse(readFileSync(appFile)) : {}
  if (!app.DATABASE_MIGRATION_URL) throw new Error('Missing DATABASE_MIGRATION_URL in .env.postgres.app. Run npm run postgres:app:setup first.')
  if (new URL(app.DATABASE_MIGRATION_URL).pathname !== `/${database}`) throw new Error('Unexpected application database')

  const pool = new Pool({ connectionString: app.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  let password: string | undefined
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        "insert into public.profiles(full_name,email,role) values('ผู้ใช้งาน',$1,'user') on conflict (lower(email)) do nothing returning id",
        [email],
      )
      if (result.rows[0]) {
        if (!existsSync(userCredentialsFile)) {
          writeEnv(userCredentialsFile, { INITIAL_USER_EMAIL: email, INITIAL_USER_PASSWORD: secret() })
        }
        const initial = parse(readFileSync(userCredentialsFile))
        if (initial.INITIAL_USER_EMAIL !== email || !initial.INITIAL_USER_PASSWORD) {
          throw new Error('Invalid starter user credentials in .env.postgres.user')
        }
        password = initial.INITIAL_USER_PASSWORD
        const hash = await hashPassword(password)
        await client.query('insert into private_auth.credentials(user_id,password_hash) values($1,$2)', [result.rows[0].id,hash])
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  } finally { await pool.end() }

  if (password) {
    console.log('[postgres:user:setup] Created starter account (user).')
    console.log(`  Email: ${email}`)
    if (process.stdout.isTTY && !process.env.CI) console.log(`  Password: ${password}`)
    console.log(`  Credentials file: ${userCredentialsFile} (INITIAL_USER_EMAIL, INITIAL_USER_PASSWORD)`)
  } else {
    console.log(`[postgres:user:setup] Account ${email} already exists. Starter account creation skipped.`)
  }
}
async function activate() {
  const app = parse(readFileSync(appFile))
  for (const key of ['DATABASE_URL', 'DATABASE_AUTH_URL']) {
    if (!app[key]) throw new Error(`Missing ${key} in .env.postgres.app. Run npm run postgres:app:setup first.`)
    const pool = new Pool({ connectionString: app[key], connectionTimeoutMillis: 5000 })
    try {
      await pool.query('select 1')
    } catch (error) {
      throw new Error(`Could not connect using ${key} in .env.postgres.app. Check the saved credentials and run npm run postgres:app:setup successfully before activating.`, { cause: error })
    } finally {
      await pool.end()
    }
  }
  mkdirSync('.cache/postgres', { recursive:true })
  if (existsSync('.env.local') && !existsSync('.cache/postgres/previous-env.local')) {
    copyFileSync('.env.local','.cache/postgres/previous-env.local')
    console.log('[postgres:activate] Backed up the previous configuration to .cache/postgres/previous-env.local.')
  }
  const previous = existsSync('.env.local') ? parse(readFileSync('.env.local')) : {}
  const next = Object.fromEntries(Object.entries(previous).filter(([key]) => !key.includes('SUPABASE') && key !== 'DATABASE_MIGRATION_URL'))
  for (const key of ['DATA_BACKEND','NEXT_PUBLIC_DATA_BACKEND','DATABASE_URL','DATABASE_AUTH_URL','LOCAL_STORAGE_PATH']) next[key] = app[key]
  writeFileSync('.env.local',Object.entries(next).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600})
  console.log('[postgres:activate] PostgreSQL settings saved to .env.local. Start or restart the app with npm run dev.')
}
async function main() {
  if (process.argv[2] === 'setup') await setup()
  else if (process.argv[2] === 'user-setup') await setupUser()
  else if (process.argv[2] === 'activate') await activate()
  else if (process.argv[2] === 'migrate') {
    const connectionString = process.env.DATABASE_MIGRATION_URL ||
      (existsSync(appFile) ? parse(readFileSync(appFile)).DATABASE_MIGRATION_URL : undefined)
    if (!connectionString) throw new Error('Set DATABASE_MIGRATION_URL before applying CAMMS migrations')
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 })
    try { await migratePostgres(pool) }
    finally { await pool.end() }
  } else throw new Error('Usage: tsx scripts/postgres-app.ts setup|user-setup|activate|migrate')
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'PostgreSQL setup failed'); process.exitCode=1 })
