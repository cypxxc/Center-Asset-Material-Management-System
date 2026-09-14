import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { localPostgresConfig } from './postgres-local-config'
import { hashPassword } from '../lib/postgres/password'

const appFile = '.env.postgres.app'
const database = 'camms_registry'
const secret = () => randomBytes(32).toString('hex')
function writeEnv(file: string, values: Record<string, string>) {
  writeFileSync(file, Object.entries(values).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' })
}
async function setup() {
  const local = localPostgresConfig(parse(readFileSync('.env.postgres.local')))
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
    if (!existing.rowCount) await owner.query('CREATE DATABASE camms_registry')
  } finally { await owner.end() }
  const migrationPool = new Pool({ connectionString: app!.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  try {
    await migrate(drizzle(migrationPool), { migrationsFolder: './db/postgres/migrations' })
    const client = await migrationPool.connect()
    try {
    await client.query('BEGIN')
    await client.query("select pg_advisory_xact_lock(hashtext('camms-initial-admin'))")
    const count = await client.query('select count(*)::int as count from public.profiles')
    if (count.rows[0].count === 0) {
      const credentialsFile = '.env.postgres.admin'
      if (!existsSync(credentialsFile)) writeEnv(credentialsFile, { INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@camms.local', INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || secret() })
      const initial = parse(readFileSync(credentialsFile))
      const hash = await hashPassword(initial.INITIAL_ADMIN_PASSWORD)
      const result = await client.query("insert into public.profiles(full_name,email,role) values('ผู้ดูแลระบบ',$1,'admin') returning id", [initial.INITIAL_ADMIN_EMAIL])
      await client.query('insert into private_auth.credentials(user_id,password_hash) values($1,$2)', [result.rows[0].id,hash])
      console.log('Created initial administrator; credentials are saved in .env.postgres.admin.')
    }
    await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    mkdirSync(app!.LOCAL_STORAGE_PATH,{ recursive:true })
    console.log('Fresh application schema is ready in Docker: camms_registry. Existing installations retained; no Supabase data imported.')
  } finally { await migrationPool.end() }
}
function activate() {
  const app = parse(readFileSync(appFile))
  mkdirSync('.cache/postgres', { recursive:true })
  if (existsSync('.env.local') && !existsSync('.cache/postgres/previous-env.local')) copyFileSync('.env.local','.cache/postgres/previous-env.local')
  const previous = existsSync('.env.local') ? parse(readFileSync('.env.local')) : {}
  const next = Object.fromEntries(Object.entries(previous).filter(([key]) => !key.includes('SUPABASE') && key !== 'DATABASE_MIGRATION_URL'))
  for (const key of ['DATA_BACKEND','NEXT_PUBLIC_DATA_BACKEND','DATABASE_URL','DATABASE_AUTH_URL','LOCAL_STORAGE_PATH']) next[key] = app[key]
  writeFileSync('.env.local',Object.entries(next).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600})
  console.log('Local application configured for PostgreSQL. Previous configuration backed up in .cache/postgres/previous-env.local. Restart the app to apply.')
}
async function main() {
  if (process.argv[2] === 'setup') await setup()
  else if (process.argv[2] === 'activate') activate()
  else throw new Error('Usage: tsx scripts/postgres-app.ts setup|activate')
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'PostgreSQL setup failed'); process.exitCode=1 })
