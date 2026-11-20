/* eslint-disable @typescript-eslint/no-require-imports -- Mocking queries without a live database. */
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

test('returnPostgresCustody requires active admin, locks item, clears custodian, and records audit log', async () => {
  const authPath = require.resolve('../../features/auth/queries')
  const databasePath = require.resolve('../../lib/postgres/request')
  require(authPath)
  require(databasePath)
  const auth = require.cache[authPath]!
  const database = require.cache[databasePath]!
  const previousAuth = auth.exports
  const previousDatabase = database.exports
  const dialect = new PgDialect()
  const executedQueries: ReturnType<typeof dialect.sqlToQuery>[] = []

  let role = 'admin'
  auth.exports = {
    ...previousAuth,
    getCurrentProfile: async () => ({ id: 'admin-1', is_active: true, role, full_name: 'Admin User' }),
  }

  const itemId = 'a0000000-0000-4000-8000-000000000001'
  const locationId = 'b0000000-0000-4000-8000-000000000002'

  let mockItem = {
    id: itemId,
    item_type: 'asset',
    item_name: 'เครื่องคอมพิวเตอร์',
    asset_no: 'ASSET-2026-001',
    is_central: false,
    responsible_person: 'นายสมชาย ใจดี',
    status: 'active',
    location_id: null,
    note: 'ใช้งานประจำ',
  }

  let mockOriginFound = true

  database.exports = {
    ...previousDatabase,
    withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        execute: async (query: SQL) => {
          const compiled = dialect.sqlToQuery(query)
          executedQueries.push(compiled)
          if (compiled.sql.includes('SELECT id, item_type') && compiled.sql.includes('FOR UPDATE')) {
            return { rows: [mockItem] }
          }
          if (compiled.sql.includes("action = 'ASSIGN_CUSTODY'")) {
            return {
              rows: mockOriginFound
                ? [{ origin_location_id: locationId, old_location_id: null, log_created_at: '2026-11-01', log_id: '1' }]
                : [],
            }
          }
          if (compiled.sql.includes('FROM public.locations WHERE id =')) {
            return { rows: mockOriginFound ? [{ id: locationId, name: 'ห้องคลังกลาง' }] : [] }
          }
          return { rows: [] }
        },
      }),
  }

  try {
    const { returnPostgresCustody } = require('../../features/disbursements/custody-postgres')

    // Test 1: Successful return with normal condition
    const res = await returnPostgresCustody({
      item_id: itemId,
      condition: 'normal',
      reason: 'สิ้นสุดการใช้งาน',
      location_id: locationId,
      note: 'ส่งคืนสภาพสมบูรณ์',
    })

    assert.equal(res.ok, true)
    assert.equal(res.item_id, itemId)

    const returnEvent = executedQueries.find(q => q.sql.includes('private.apply_asset_custody_event'))
    assert.ok(returnEvent?.sql.includes("NULL, 'custody_return'"))
    assert.equal(returnEvent.params[0], itemId)
    assert.equal(returnEvent.params[1], 'normal')
    assert.equal(returnEvent.params.at(-1), locationId)

    // Verify INSERT audit_logs query
    const auditQuery = executedQueries.find(q => q.sql.includes('INSERT INTO public.audit_logs'))
    assert.ok(auditQuery, 'Must record audit log')
    assert.ok(auditQuery.sql.includes('RETURN_CUSTODY'))

    // Test 2: Condition = damaged sets status = 'damaged'
    executedQueries.length = 0
    await returnPostgresCustody({
      item_id: itemId,
      condition: 'damaged',
      reason: 'จอภาพแตก',
    })
    const damagedUpdate = executedQueries.find(q => q.sql.includes('private.apply_asset_custody_event'))
    assert.ok(damagedUpdate)
    assert.ok(damagedUpdate.params.includes('damaged'))

    // Test 3: Reject non-admin
    role = 'user'
    await assert.rejects(
      returnPostgresCustody({
        item_id: itemId,
        condition: 'normal',
        reason: 'สิ้นสุดการใช้งาน',
      }),
      /เฉพาะผู้ดูแลระบบเท่านั้น/
    )
    role = 'admin'

    // Test 4: Cannot return if already central and has no custodian
    mockItem = {
      ...mockItem,
      is_central: true,
      responsible_person: null,
    }
    await assert.rejects(
      returnPostgresCustody({
        item_id: itemId,
        condition: 'normal',
        reason: 'ทดสอบ',
      }),
      /ถูกรับคืนเป็นของส่วนกลางแล้ว/
    )
    // Test 5: Reject if origin location cannot be found
    mockItem = {
      ...mockItem,
      is_central: false,
      responsible_person: 'นายสมชาย ใจดี',
    }
    mockOriginFound = false
    await assert.rejects(
      returnPostgresCustody({
        item_id: itemId,
        condition: 'normal',
        reason: 'ทดสอบ',
      }),
      /ไม่พบข้อมูลสถานที่ต้นทางเดิมก่อนสั่งจ่าย/
    )
  } finally {
    auth.exports = previousAuth
    database.exports = previousDatabase
  }
})
