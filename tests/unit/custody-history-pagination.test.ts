/* eslint-disable @typescript-eslint/no-require-imports -- Isolate authenticated query dependencies without a live database. */
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

test('custody history applies search before paging, clamps pages and requires an active admin', async () => {
  const authPath = require.resolve('../../features/auth/queries')
  const databasePath = require.resolve('../../lib/postgres/request')
  require(authPath)
  require(databasePath)
  const auth = require.cache[authPath]!
  const database = require.cache[databasePath]!
  const previousAuth = auth.exports
  const previousDatabase = database.exports
  const dialect = new PgDialect()
  const queries: ReturnType<typeof dialect.sqlToQuery>[] = []
  let role = 'admin'
  let total = 125
  auth.exports = { ...previousAuth, getCurrentProfile: async () => ({ is_active: true, role }) }
  database.exports = { ...previousDatabase, withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    execute: async (query: SQL) => {
      const compiled = dialect.sqlToQuery(query)
      queries.push(compiled)
      return { rows: compiled.sql.includes('count(*)') ? [{ total }] : [] }
    },
  }) }
  try {
    const { getCustodyHistory } = require('../../features/disbursements/custody-postgres')
    const result = await getCustodyHistory({ page: 3, q: 'สมชาย' })
    assert.equal(result.total, 125)
    assert.equal(result.totalPages, 7)
    assert.equal(result.page, 3)
    assert.ok(queries.every(query => query.sql.includes('ILIKE')))
    assert.ok(queries.every(query => query.params.includes('%สมชาย%')))
    assert.deepEqual(queries[1].params.slice(-2), [20, 40])
    assert.match(queries[1].sql, /ORDER BY h.created_at DESC, h.id DESC LIMIT/)
    assert.equal((await getCustodyHistory({ page: 99 })).page, 7)
    assert.deepEqual(queries.at(-1)!.params.slice(-2), [20, 120])
    total = 0
    assert.equal((await getCustodyHistory({ page: 99 })).page, 1)
    await assert.rejects(getCustodyHistory({ page: 0 }))
    const count = queries.length
    role = 'user'
    await assert.rejects(getCustodyHistory({ page: 1 }))
    assert.equal(queries.length, count, 'authorization must run before querying history')
  } finally { auth.exports = previousAuth; database.exports = previousDatabase }
})
