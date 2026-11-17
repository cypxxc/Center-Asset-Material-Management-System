import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

test('dashboard request navigation constrains the existing approval query to the selected UUID', async () => {
  const dbPath = require.resolve('../../lib/postgres/request')
  const originalDb = require.cache[dbPath]
  const statements: { sql: string; params: unknown[] }[] = []
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    withUserDatabase: async (operation: (tx: unknown) => unknown) => operation({
      execute: async (statement: SQL) => {
        statements.push(new PgDialect().sqlToQuery(statement))
        return { rows: statements.length === 1 ? [{ count: 0 }] : [] }
      },
    }),
  } } as NodeJS.Module
  try {
    const { getPostgresDisbursements } = await import('../../features/disbursements/postgres-queries')
    const target = '22222222-2222-4222-8222-222222222222'
    await getPostgresDisbursements({ status: 'pending_approval', request_id: target })
    for (const statement of [statements[0], statements[2]]) {
      assert.match(statement.sql, /d\.id\s*=\s*\$\d+::uuid/)
      assert.ok(statement.params.includes(target))
      assert.ok(statement.params.includes('pending_approval'))
    }
    statements.length = 0
    await assert.rejects(getPostgresDisbursements({ request_id: 'invalid-id' }))
    assert.equal(statements.length, 0)

    await getPostgresDisbursements({ hideCompleted: true })
    for (const statement of [statements[0], statements[2]]) {
      assert.match(statement.sql, /d\.status not in /)
      assert.ok(statement.params.includes('returned'))
      for (const status of ['confirmed', 'cancelled', 'reversed', 'rejected']) {
        assert.ok(statement.params.includes(status), `approval queue excludes ${status}`)
      }
    }
    assert.match(statements[2].sql, /di\.status <> 'returned'/)

    statements.length = 0
    await getPostgresDisbursements({ historyOnly: true })
    for (const statement of [statements[0], statements[2]]) {
      assert.match(statement.sql, /d\.status in /)
      for (const status of ['confirmed', 'cancelled', 'reversed', 'returned', 'rejected']) assert.ok(statement.params.includes(status))
      assert.doesNotMatch(statement.sql, /d\.status <> 'rejected'/)
    }
    assert.doesNotMatch(statements[2].sql, /di\.status <> 'returned'/, 'history keeps completed item details')

    statements.length = 0
    await getPostgresDisbursements()
    assert.doesNotMatch(statements[0].sql, /d\.status <> 'returned'/)
    assert.doesNotMatch(statements[0].sql, /d\.status <> 'confirmed'/)
    assert.doesNotMatch(statements[2].sql, /di\.status <> 'returned'/)
  } finally {
    if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath]
  }
})
