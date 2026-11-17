import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

test('handover recording is admin-only, locks the document, audits once, and never changes stock', async () => {
  let role = 'user'
  let status = 'confirmed'
  let handedOverAt: string | null = null
  const queries: string[] = []
  const dialect = new PgDialect()
  const id = 'db63f39c-0094-4696-a36f-52b04aeb7339'
  const tx = { execute: async (query: SQL) => {
    const { sql } = dialect.sqlToQuery(query)
    queries.push(sql)
    if (sql.startsWith('select')) return { rows: [{ id, transaction_type: 'material_issue', status, handed_over_at: handedOverAt, handed_over_by: handedOverAt ? id : null }] }
    if (sql.startsWith('update')) {
      handedOverAt = '2026-11-16T12:00:00Z'
      return { rows: [{ id, handed_over_at: handedOverAt, handed_over_by: id }] }
    }
    return { rows: [] }
  } }
  const mocks: Record<string, unknown> = {
    'server-only': {},
    '../auth/queries': { getCurrentProfile: async () => ({ id, role, is_active: true }) },
    '../../lib/postgres/request': { withUserDatabase: (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) },
  }
  for (const [name, exports] of Object.entries(mocks)) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const { markPostgresDisbursementHandover } = await import('./tracking-postgres')
  await assert.rejects(markPostgresDisbursementHandover(id), /ผู้ดูแล/)
  assert.equal(queries.length, 0)
  role = 'admin'
  status = 'pending_approval'
  await assert.rejects(markPostgresDisbursementHandover(id), /อนุมัติ/)
  assert.equal(queries.some(query => query.startsWith('update')), false)
  queries.length = 0
  status = 'confirmed'
  const first = await markPostgresDisbursementHandover(id)
  const second = await markPostgresDisbursementHandover(id)
  assert.equal(first.handed_over_at, second.handed_over_at)
  assert.equal(queries.filter(query => query.startsWith('update')).length, 1)
  assert.equal(queries.filter(query => query.includes('insert into public.audit_logs')).length, 1)
  assert.ok(queries.filter(query => query.startsWith('select')).every(query => query.includes('for update')))
  assert.equal(queries.some(query => /stock_movements|public\.items|public\.materials/.test(query)), false)
})
