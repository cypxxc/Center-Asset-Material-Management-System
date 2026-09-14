import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, types } from 'pg'
import { sql } from 'drizzle-orm'
import * as schema from '@/db/postgres/schema'

// Preserve the existing JSON-facing number and ISO timestamp contracts.
types.setTypeParser(1700, Number)
types.setTypeParser(1082, (value) => value)
types.setTypeParser(1184, (value) => new Date(value).toISOString())
const state = globalThis as typeof globalThis & { cammsPg?: Pool; cammsAuthPg?: Pool }
function pool(kind: 'app' | 'auth') {
  const key = kind === 'app' ? 'cammsPg' : 'cammsAuthPg'
  if (!state[key]) {
    const connectionString = process.env[kind === 'app' ? 'DATABASE_URL' : 'DATABASE_AUTH_URL']
    if (!connectionString) throw new Error('PostgreSQL connection is not configured')
    state[key] = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000 })
    state[key].on('error', () => console.error('PostgreSQL idle connection failed'))
  }
  return state[key]!
}
export function getDatabase() { return drizzle(pool('app'), { schema }) }
/** Only authentication and explicitly authorized account management may use this pool. */
export function getAuthDatabase() { return drizzle(pool('auth'), { schema }) }
/** Release CLI/test connections; application requests retain their shared pools. */
export async function closePostgresPools() {
  const pools = [state.cammsPg, state.cammsAuthPg]
  delete state.cammsPg
  delete state.cammsAuthPg
  await Promise.all(pools.map((entry) => entry?.end()))
}
export type PostgresTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0]
export async function withIdentity<T>(userId: string, callback: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(userId)) throw new Error('Invalid session identity')
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    return callback(tx)
  })
}
