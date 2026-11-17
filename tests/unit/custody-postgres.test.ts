import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const id = '00000000-0000-4000-8000-000000000001'
const recipientId = '00000000-0000-4000-8000-000000000002'
let role = 'admin'
let central = true
let borrowed = false
const writes: { sql: string; params: unknown[] }[] = []
const dialect = new PgDialect()

function stub(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
stub('../../features/auth/queries', { getCurrentProfile: async () => ({ id, role, is_active: true }) })
stub('../../lib/postgres/request', {
  withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement)
      if (query.sql.includes('from public.inventory_registry')) return { rows: [{ item_type: 'asset' }] }
      if (query.sql.includes('FROM public.profiles')) return { rows: [{ id: recipientId, full_name: 'ผู้รับใหม่' }] }
      if (/FROM public\."?items"?/.test(query.sql)) return { rows: [{ id, item_type: 'asset', item_name: 'โต๊ะส่วนกลาง', is_central: central, note: central ? 'บันทึกเดิม\nส่วนกลาง' : 'บันทึกเดิม', responsible_person: 'ผู้รับเดิม', status: 'active', asset_no: 'A-01' }] }
      if (query.sql.includes('FROM public.disbursement_items')) return { rows: [{ count: borrowed ? 1 : 0 }] }
      if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(query.sql)) writes.push(query)
      return { rows: [] }
    },
  }),
})
stub('../../features/disbursements/queries', { getDisbursementSelectableItems: async () => [] })
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assignPostgresCustody, inspectHistoricalPool } = require('../../features/disbursements/custody-postgres') as typeof import('../../features/disbursements/custody-postgres')

test('admin assigns custody with old/new audit evidence and no disbursement document', async () => {
  writes.length = 0
  const result = await assignPostgresCustody({ item_ids: [id], recipient_id: recipientId })
  assert.equal(result.assigned, 1)
  const update = writes.find((query) => query.sql.includes('UPDATE public.items'))!
  assert.ok(update.params.includes('ผู้รับใหม่'))
  assert.ok(update.sql.includes('is_central = false'))
  assert.ok(update.params.includes('บันทึกเดิม'))
  const audit = writes.find((query) => query.sql.includes('INSERT INTO public.audit_logs'))!
  assert.ok(audit.sql.includes('ASSIGN_CUSTODY'))
  assert.ok(audit.params.some((value) => typeof value === 'string' && value.includes('ผู้รับเดิม')))
  assert.ok(audit.params.some((value) => typeof value === 'string' && value.includes(recipientId)))
  assert.equal(writes.some((query) => query.sql.includes('public.disbursements')), false)
})

test('user cannot assign custody', async () => {
  role = 'user'; writes.length = 0
  try {
    await assert.rejects(assignPostgresCustody({ item_ids: [id], recipient_id: recipientId }), /ผู้ดูแลระบบ/)
    assert.equal(writes.length, 0)
  } finally { role = 'admin' }
})

test('historical pool inspection is restricted to admins', async () => {
  role = 'user'; writes.length = 0
  try {
    await assert.rejects(inspectHistoricalPool(), /ผู้ดูแลระบบ/)
    assert.equal(writes.length, 0)
  } finally { role = 'admin' }
})

test('non-central and currently borrowed assets cannot be assigned', async () => {
  writes.length = 0; central = false
  try { await assert.rejects(assignPostgresCustody({ item_ids: [id], recipient_id: recipientId }), /ส่วนกลาง/) }
  finally { central = true }
  borrowed = true
  try { await assert.rejects(assignPostgresCustody({ item_ids: [id], recipient_id: recipientId }), /รออนุมัติ|กำลังยืม/) }
  finally { borrowed = false }
  assert.equal(writes.length, 0)
})
