import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const id = '00000000-0000-4000-8000-000000000003'
const dialect = new PgDialect()
const queries: string[] = []
let reserved = true
let role = 'user'
let owner = id
function stub(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
stub('../../features/auth/queries', { getCurrentProfile: async () => ({ id, role, is_active: true }) })
stub('../../lib/postgres/request', {
  withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) => callback({ execute: async (statement: SQL) => {
    const query = dialect.sqlToQuery(statement)
    queries.push(query.sql)
    if (query.sql.includes('SELECT id,payload_hash FROM public.request_batches')) return { rows: [] }
    if (query.sql.includes('public.inventory_registry')) return { rows: [{ id, item_type: 'asset' }] }
    if (query.sql.includes('SELECT * FROM public.disbursements')) return { rows: [{ id, status: 'pending_approval', created_by: owner, transaction_type: 'material_issue' }] }
    if (query.sql.includes('count(*)')) return { rows: [{ count: reserved ? 1 : 0 }] }
    if (query.sql.includes('FROM public.items') || query.sql.includes('FROM public."items"') || query.sql.includes('FROM public.inventory_items')) {
      if (query.sql.includes('NOT EXISTS') && reserved && query.sql.includes("'pending_approval'")) return { rows: [] }
      return { rows: [{ id, item_name: 'ส่วนกลาง', item_type: 'asset', is_central: true, note: 'ส่วนกลาง', status: 'active', quantity: 1 }] }
    }
    return { rows: [{ id, item_name: 'ส่วนกลาง', item_type: 'asset', is_central: true, note: 'ส่วนกลาง', status: 'active', quantity: 1 }] }
  } }),
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitPostgresBorrowRequest, createPostgresDisbursementDraft, cancelPostgresDisbursementDraft, rejectPostgresDisbursement } = require('../../features/disbursements/postgres-actions') as typeof import('../../features/disbursements/postgres-actions')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPostgresCentralAvailableItems, getPostgresDisbursementSelectableItems } = require('../../features/disbursements/postgres-queries') as typeof import('../../features/disbursements/postgres-queries')

test('catalog and item picker exclude pending reservations and restore released items', async () => {
  reserved = true
  assert.deepEqual(await getPostgresCentralAvailableItems(), [])
  assert.deepEqual(await getPostgresDisbursementSelectableItems(), [])
  reserved = false
  assert.equal((await getPostgresCentralAvailableItems())[0].id, id)
  assert.equal((await getPostgresDisbursementSelectableItems())[0].id, id)
})

for (const request_type of ['borrow', 'issue'] as const) {
  test(`pending reservation prevents a duplicate ${request_type} request before writing`, async () => {
    reserved = true; queries.length = 0
    await assert.rejects(submitPostgresBorrowRequest({ item_ids: [id], request_type, due_date: '2099-01-01', purpose: 'ใช้งาน' }), /ซ้ำ|รออนุมัติ/)
    assert.equal(queries.some((query) => query.includes('INSERT INTO public.disbursements')), false)
  })
}

test('request locks inventory before checking reservations', async () => {
  reserved = false; queries.length = 0
  await submitPostgresBorrowRequest({ item_ids: [id], request_type: 'borrow', due_date: '2099-01-01', purpose: 'ใช้งาน' })
  const lock = queries.findIndex((query) => query.includes('pg_advisory_xact_lock'))
  const check = queries.findIndex((query) => query.includes('count(*)'))
  assert.ok(lock >= 0 && lock < check)
  assert.equal(queries.some((query) => query.includes('FROM public.items') && query.includes('FOR UPDATE')), false, 'user must not require inventory UPDATE policy')
})

test('catalog requests and draft creation both record their request audit', async () => {
  reserved = false; queries.length = 0; role = 'admin'
  try {
    await createPostgresDisbursementDraft({ transaction_type: 'asset_handover', recipient_name: 'User', department_name: 'Office', purpose: 'Office', items: [{ item_id: id, requested_qty: 1 }] })
    assert.ok(queries.some((query) => query.includes('INSERT INTO public.audit_logs')))
  } finally { role = 'user' }
})

test('user can withdraw only their own pending request', async () => {
  reserved = false; queries.length = 0; owner = id
  await cancelPostgresDisbursementDraft({ id })
  assert.ok(queries.some((query) => query.includes('UPDATE public.disbursements')))
  owner = '00000000-0000-4000-8000-000000000099'; queries.length = 0
  try {
    await assert.rejects(cancelPostgresDisbursementDraft({ id }), /สิทธิ์|ตนเอง/)
    assert.equal(queries.some((query) => query.includes('UPDATE public.disbursements')), false)
  } finally { owner = id }
})

test('reject action actually applies reason validation before querying', async () => {
  role = 'admin'; queries.length = 0
  try {
    await assert.rejects(rejectPostgresDisbursement(id, 'x'.repeat(501)))
    assert.equal(queries.length, 0)
  } finally { role = 'user' }
})

test('released reservations allow a new request without reducing physical stock early', async () => {
  reserved = false; queries.length = 0
  await submitPostgresBorrowRequest({ item_ids: [id], request_type: 'issue', purpose: 'ใช้งาน' })
  assert.ok(queries.some((query) => query.includes('INSERT INTO public.disbursements')))
  assert.equal(queries.some((query) => query.includes('UPDATE public.items')), false)
})
