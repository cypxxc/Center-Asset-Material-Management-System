import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import { pgSchema, text, uuid } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import { localPostgresConfig, withoutSupabase } from './postgres-local-config'

const envFile = '.env.postgres.local'
const isolatedEnv: NodeJS.ProcessEnv = { ...withoutSupabase(process.env), NODE_ENV: process.env.NODE_ENV ?? 'development' }

function compose(...args: string[]) {
  const result = spawnSync('docker', ['compose', '--env-file', envFile, '-f', 'compose.postgres.yaml', ...args], {
    env: isolatedEnv, stdio: 'inherit', timeout: 180_000,
  })
  if (result.error || result.status !== 0) throw new Error('Docker Compose operation failed; check Docker Desktop and the output above')
}

function readConfig() {
  return localPostgresConfig(parse(readFileSync(envFile)))
}

async function verify() {
  // The test process itself also has no Supabase or inherited PostgreSQL credentials.
  for (const key of Object.keys(process.env)) {
    if (!(key in isolatedEnv)) delete process.env[key]
  }
  assert.equal(Object.keys(process.env).some((key) => key.toUpperCase().includes('SUPABASE')), false)
  const config = readConfig()
  const makePool = () => new Pool({ connectionString: config.connectionString, max: 2, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 })
  let pool = makePool()
  let db = drizzle(pool)
  const schemaName = `connection_test_${randomUUID().replaceAll('-', '')}`
  const records = pgSchema(schemaName).table('records', { id: uuid().primaryKey(), value: text().notNull() })
  let schemaCreated = false
  try {
    const identity = await db.execute<{ database: string; version: string }>(sql`select current_database() as database, version() as version`)
    assert.equal(identity.rows[0].database, config.database)
    console.log(`Connected through Drizzle to 127.0.0.1:${config.port}/${config.database}; Supabase credentials absent.`)
    await db.execute(sql`create schema ${sql.identifier(schemaName)}`)
    schemaCreated = true
    await db.execute(sql`create table ${records} (id uuid primary key, value text not null)`)
    const id = randomUUID()
    await db.insert(records).values({ id, value: 'before restart' })
    assert.equal((await db.select().from(records).where(eq(records.id, id)))[0]?.value, 'before restart')
    await db.update(records).set({ value: 'persistent value' }).where(eq(records.id, id))
    const rollback = new Error('expected rollback')
    await assert.rejects(db.transaction(async (tx) => {
      await tx.update(records).set({ value: 'must not persist' }).where(eq(records.id, id))
      throw rollback
    }), (error: unknown) => error === rollback)
    assert.equal((await db.select().from(records).where(eq(records.id, id)))[0]?.value, 'persistent value')
    console.log('PASS: typed insert/read/update and transaction rollback.')
    await pool.end()
    compose('restart', 'postgres')
    compose('up', '-d', '--wait', '--wait-timeout', '60', 'postgres')
    pool = makePool()
    db = drizzle(pool)
    assert.equal((await db.select().from(records).where(eq(records.id, id)))[0]?.value, 'persistent value')
    console.log('PASS: committed data survives container restart.')
    await db.delete(records).where(eq(records.id, id))
    assert.equal((await db.select().from(records)).length, 0)
    console.log('PASS: typed delete. This verifies the database connection only; web application migration is separate.')
  } finally {
    // Use a fresh connection even if restart failed after the original pool closed.
    const cleanup = makePool()
    try {
      if (schemaCreated) await drizzle(cleanup).execute(sql`drop schema ${sql.identifier(schemaName)} cascade`)
    } finally {
      await cleanup.end()
      if (!pool.ended) await pool.end()
    }
  }
}

async function main() {
  const command = process.argv[2]
  if (command === 'setup') {
    try {
      writeFileSync(envFile, `POSTGRES_USER=camms_local\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nPOSTGRES_DB=camms_local\nPOSTGRES_PORT=15432\n`, { flag: 'wx', mode: 0o600 })
      console.log(`Created ${envFile} with a random local password.`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      readConfig()
      console.log('Existing local PostgreSQL configuration retained.')
    }
  } else if (command === 'up') {
    readConfig()
    compose('up', '-d', '--wait', '--wait-timeout', '60', 'postgres')
  } else if (command === 'stop') {
    readConfig()
    compose('stop', 'postgres')
  } else if (command === 'test') {
    await verify()
  } else {
    throw new Error('Usage: tsx scripts/postgres-local.ts setup|up|stop|test')
  }
}

main().catch((error: unknown) => {
  // Avoid printing connection strings or the environment file in error output.
  console.error(error instanceof Error ? error.message : 'Local PostgreSQL operation failed')
  process.exitCode = 1
})
