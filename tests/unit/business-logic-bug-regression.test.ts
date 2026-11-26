import '../setup/dom'
/* eslint-disable @typescript-eslint/no-require-imports */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const dialect = new PgDialect()

// 1. Shared mutable profile mock
let mockProfile = {
  id: '00000000-0000-4000-8000-000000000099',
  role: 'admin',
  is_active: true,
}

function stub(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

stub('../../features/auth/queries', {
  getCurrentProfile: async () => mockProfile,
})

// 2. Shared mutable database query dispatcher
type QueryResult = { rows: Record<string, unknown>[] }
type QueryHandler = (query: { sql: string; params: unknown[] }) => QueryResult | Promise<QueryResult>

let activeQueryHandler: QueryHandler = () => ({ rows: [] })

stub('../../lib/postgres/request', {
  withUserDatabase: async (operation: (tx: unknown) => unknown) =>
    operation({
      execute: async (statement: SQL) => {
        const query = dialect.sqlToQuery(statement)
        return activeQueryHandler(query)
      },
    }),
})

// Load modules via require so they resolve against stubbed dependencies
const { batchSummary } = require('../../features/disbursements/request-batch')
const { generateDisbursementVoucherHtml } = require('../../features/disbursements/print-generator')
const {
  cancelPostgresDisbursementDraft,
  confirmPostgresDisbursement,
  partialApprovePostgresDisbursement,
  partialRejectPostgresDisbursement,
  returnPostgresDisbursementItem,
  reversePostgresDisbursement,
  partialReturnPostgresDisbursement,
  rejectPostgresDisbursement,
} = require('../../features/disbursements/postgres-actions')
const { getPostgresDisbursements } = require('../../features/disbursements/postgres-queries')
const { returnPostgresCustody } = require('../../features/disbursements/custody-postgres')
const { mutatePostgresItems } = require('../../features/items/postgres-actions')
const { pgDeleteTableRow } = require('../../features/admin/postgres-admin')

// ==========================================
// BUG-10: Batch summary terminal status logic
// ==========================================
test('BUG-10: batchSummary correctly identifies mixed completed batches as สิ้นสุดแล้ว', () => {
  assert.equal(batchSummary(['confirmed', 'returned']), 'สิ้นสุดแล้ว')
  assert.equal(batchSummary(['confirmed', 'confirmed']), 'สิ้นสุดแล้ว')
  assert.equal(batchSummary(['returned', 'returned']), 'สิ้นสุดแล้ว')
  assert.equal(batchSummary(['confirmed', 'returned', 'cancelled']), 'สิ้นสุดแล้ว')
  assert.equal(batchSummary(['confirmed', 'pending_approval']), 'ดำเนินการบางส่วน')
  assert.equal(batchSummary(['returned', 'active_borrow']), 'ดำเนินการบางส่วน')
})

// ==========================================
// BUG-06: Print voucher displays requested qty for pending requests
// ==========================================
test('BUG-06: generateDisbursementVoucherHtml outputs requested_qty for pending_approval vouchers', () => {
  const doc = {
    id: '00000000-0000-4000-8000-000000000001',
    document_no: null,
    transaction_type: 'material_issue',
    recipient_name: 'สมชาย ใจดี',
    department_name: 'งานพัสดุ',
    purpose: 'ใช้ในงานราชการ',
    status: 'pending_approval',
    due_date: null,
    fiscal_year: null,
    confirmed_at: null,
    confirmed_by: null,
    handed_over_at: null,
    handed_over_by: null,
    reversed_at: null,
    reversed_by: null,
    reversal_reason: null,
    created_by: '00000000-0000-4000-8000-000000000002',
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
  }
  const items = [
    {
      id: '00000000-0000-4000-8000-000000000003',
      disbursement_id: doc.id,
      item_id: '00000000-0000-4000-8000-000000000004',
      requested_qty: 10,
      issued_qty: 0,
      returned_qty: 0,
      status: 'pending',
      item_name_snapshot: 'กระดาษ A4',
      asset_no_snapshot: null,
      serial_no_snapshot: null,
      brand_snapshot: null,
      model_snapshot: null,
      unit_name_snapshot: 'รีม',
      unit_price_snapshot: 150.0,
      category_name_snapshot: 'วัสดุสำนักงาน',
      location_name_snapshot: 'คลังพัสดุ',
      created_at: '2026-11-20T10:00:00Z',
    },
  ]

  const html = generateDisbursementVoucherHtml(doc, [
    ...items,
    { ...items[0], status: 'issued', requested_qty: 9, issued_qty: 2, unit_price_snapshot: 50 },
    { ...items[0], status: 'reversed', requested_qty: 40, item_name_snapshot: 'Rejected item' },
  ])
  assert.ok(html.includes('1,600.00'), 'total uses requested and issued quantities according to line status')
  assert.ok(!html.includes('Rejected item'))
  assert.ok(html.includes('10'), 'voucher contains requested quantity 10')
  assert.ok(html.includes('1,500.00'), 'voucher contains row total 1,500.00')
  assert.ok(html.includes('กระดาษ A4'), 'voucher contains item name')
  assert.ok(html.includes('รีม'), 'voucher contains unit')
})

// ==========================================
// BUG-01: Cancel draft rejects documents with partially issued items
// ==========================================
test('BUG-01: cancelPostgresDisbursementDraft rejects cancelling document with already issued lines', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
    is_active: true,
  }
  const docId = '11111111-1111-4111-8111-111111111111'

  activeQueryHandler = (query) => {
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return {
        rows: [
          {
            id: docId,
            status: 'pending_approval',
            created_by: '00000000-0000-4000-8000-000000000001',
          },
        ],
      }
    }
    if (query.sql.includes('SELECT count(*)::int as count FROM public.disbursement_items')) {
      return { rows: [{ count: 1 }] } // 1 item already issued!
    }
    return { rows: [] }
  }

  await assert.rejects(
    cancelPostgresDisbursementDraft({ id: docId }),
    /ไม่สามารถยกเลิกเอกสารนี้ได้เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว/
  )
})

// ==========================================
// BUG-02: Confirm disbursement only processes pending lines and excludes reversed
// ==========================================
test('BUG-02: confirmPostgresDisbursement only processes pending lines and excludes reversed lines', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const docId = '22222222-2222-4222-8222-222222222222'
  const pendingLineId = '33333333-3333-4333-8333-333333333333'
  const reversedLineId = '44444444-4444-4444-8444-444444444444'
  const itemId = '55555555-5555-4555-8555-555555555555'

  const executedQueries: string[] = []

  activeQueryHandler = (query) => {
    executedQueries.push(query.sql)
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return {
        rows: [
          {
            id: docId,
            status: 'pending_approval',
            transaction_type: 'material_issue',
            recipient_name: 'ทดสอบ',
            due_date: null,
            document_no: 'DIS-2569-0001',
            fiscal_year: 2569,
          },
        ],
      }
    }
    if (query.sql.includes('SELECT * FROM public.disbursement_items')) {
      return {
        rows: [
          {
            id: pendingLineId,
            item_id: itemId,
            status: 'pending',
            requested_qty: 2,
            issued_qty: 0,
          },
          {
            id: reversedLineId,
            item_id: itemId,
            status: 'reversed',
            requested_qty: 5,
            issued_qty: 0,
          },
        ],
      }
    }
    if (query.sql.includes('public.inventory_registry')) {
      return { rows: [{ id: itemId, item_type: 'material' }] }
    }
    if (query.sql.includes('materials') && query.sql.includes('SELECT')) {
      return {
        rows: [
          {
            id: itemId,
            item_type: 'material',
            item_name: 'วัสดุ A',
            quantity: 10,
            status: 'active',
            is_central: false,
          },
        ],
      }
    }
    if (query.sql.includes('stock_movements')) {
      return { rows: [{ net: 0 }] }
    }
    return { rows: [{ current_val: 1, id: docId }] }
  }

  const res = await confirmPostgresDisbursement(docId)
  assert.equal(res.document_no, 'DIS-2569-0001', 'reused existing allocated document_no')
  const updatedLineQueries = executedQueries.filter(
    (q) => q.includes('UPDATE public.disbursement_items') && q.includes('issued')
  )
  assert.equal(updatedLineQueries.length, 1, 'only one pending line was updated to issued')
})

// ==========================================
// BUG-03: Partial return lost condition removes item from pool and inactives
// ==========================================
test('BUG-03: partialReturnPostgresDisbursement handles lost condition safely', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const docId = '11111111-1111-4111-8111-111111111111'
  const lineId = '22222222-2222-4222-8222-222222222222'
  const itemId = '33333333-3333-4333-8333-333333333333'
  const executedStatements: { sql: string; params: unknown[] }[] = []

  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return {
        rows: [
          {
            id: docId,
            status: 'active_borrow',
            transaction_type: 'asset_borrow',
            recipient_name: 'ผู้ยืม',
          },
        ],
      }
    }
    if (query.sql.includes('SELECT * FROM public.disbursement_items')) {
      return {
        rows: [
          {
            id: lineId,
            item_id: itemId,
            status: 'issued',
            issued_qty: 1,
            returned_qty: 0,
            item_name: 'แล็ปท็อป',
          },
        ],
      }
    }
    if (query.sql.includes('public.inventory_registry')) {
      return { rows: [{ id: itemId, item_type: 'asset' }] }
    }
    if (query.sql.includes('SELECT id, item_type, note, quantity FROM')) {
      return {
        rows: [
          {
            id: itemId,
            item_type: 'asset',
            note: 'ของเดิม',
            quantity: 1,
          },
        ],
      }
    }
    if (query.sql.includes('ASSIGN_CUSTODY')) {
      return { rows: [{ origin_location_id: '00000000-0000-4000-8000-000000000077' }] }
    }
    if (query.sql.includes('public.locations')) {
      return { rows: [{ id: '00000000-0000-4000-8000-000000000077', name: 'คลังพัสดุ' }] }
    }
    if (query.sql.includes('count(*)')) {
      return { rows: [{ count: 0 }] }
    }
    return { rows: [] }
  }

  await partialReturnPostgresDisbursement({
    disbursement_id: docId,
    items: [
      {
        line_id: lineId,
        item_id: itemId,
        condition: 'lost',
        reason: 'ทำหายระหว่างเดินทาง',
      },
    ],
  })

  const loss = executedStatements.find((s) => s.sql.includes('private.apply_asset_custody_event'))
  assert.ok(loss)
  assert.ok(loss.sql.includes("'return'"))
  assert.deepEqual(loss.params, [itemId, lineId, 1, 'lost', 'ทำหายระหว่างเดินทาง', 'ของเดิม [บันทึกสูญหายจากการยืม]', null])
})

// ==========================================
// BUG-04: Return item retains custodian on partial return and decrements on lost
// ==========================================
test('BUG-04: returnPostgresDisbursementItem retains the custodian on partial return and rejects multi-unit loss', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const docId = '11111111-1111-4111-8111-111111111111'
  const lineId = '22222222-2222-4222-8222-222222222222'
  const itemId = '33333333-3333-4333-8333-333333333333'
  const executedStatements: { sql: string; params: unknown[] }[] = []

  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('SELECT disbursement_id FROM public.disbursement_items')) {
      return { rows: [{ disbursement_id: docId }] }
    }
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return {
        rows: [
          {
            id: docId,
            status: 'active_borrow',
            transaction_type: 'asset_borrow',
            recipient_name: 'ผู้ยืม ทดสอบ',
          },
        ],
      }
    }
    if (query.sql.includes('SELECT * FROM public.disbursement_items WHERE id =')) {
      return {
        rows: [
          {
            id: lineId,
            item_id: itemId,
            status: 'issued',
            issued_qty: 3,
            returned_qty: 0,
          },
        ],
      }
    }
    if (query.sql.includes('public.inventory_registry')) {
      return { rows: [{ id: itemId, item_type: 'asset' }] }
    }
    if (query.sql.includes('SELECT id, item_type, quantity, responsible_person, status, note FROM')) {
      return {
        rows: [
          {
            id: itemId,
            item_type: 'asset',
            quantity: 3,
            responsible_person: 'ผู้ยืม ทดสอบ',
            status: 'active',
            note: 'ของส่วนกลาง',
          },
        ],
      }
    }
    if (query.sql.includes('count(*)')) {
      return { rows: [{ count: 1 }] }
    }
    return { rows: [] }
  }

  // Partial return: 1 of 3 units returned normal
  await returnPostgresDisbursementItem({
    line_id: lineId,
    return_qty: 1,
    condition: 'normal',
  })
  const partialReturn = executedStatements.find((s) => s.sql.includes('private.apply_asset_custody_event'))
  assert.ok(partialReturn)
  assert.ok(partialReturn.sql.includes("'return'"))
  assert.deepEqual(partialReturn.params.slice(0, 5), [itemId, lineId, 1, 'normal', null])
  assert.doesNotMatch(String(partialReturn.params[5]), /ส่วนกลาง/)

  // Test lost condition on remaining quantity
  executedStatements.length = 0
  await assert.rejects(returnPostgresDisbursementItem({
    line_id: lineId,
    return_qty: 1,
    condition: 'lost',
  }), /จำนวนมากกว่า 1 หน่วย/)
  assert.ok(!executedStatements.some((s) => s.sql.includes('private.apply_asset_custody_event')))
})

// ==========================================
// BUG-05: Reject disbursement updates pending lines to reversed and guards partial issues
// ==========================================
test('BUG-05: rejectPostgresDisbursement transitions the header for the close trigger and rejects partially issued docs', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const docId = '11111111-1111-4111-8111-111111111111'
  const executedStatements: { sql: string; params: unknown[] }[] = []

  // Case A: Partially issued doc should throw
  activeQueryHandler = (query) => {
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return { rows: [{ id: docId, status: 'pending_approval' }] }
    }
    if (query.sql.includes('SELECT count(*)::int as count FROM public.disbursement_items')) {
      return { rows: [{ count: 1 }] } // 1 line already issued
    }
    return { rows: [] }
  }

  await assert.rejects(
    rejectPostgresDisbursement(docId, 'ไม่อนุมัติ'),
    /ไม่สามารถปฏิเสธเอกสารนี้.*เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว/
  )

  // Case B: Pending doc with no issued lines updates line status to reversed
  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('SELECT * FROM public.disbursements')) {
      return { rows: [{ id: docId, status: 'pending_approval' }] }
    }
    if (query.sql.includes('SELECT count(*)::int as count FROM public.disbursement_items')) {
      return { rows: [{ count: 0 }] } // 0 lines issued
    }
    return { rows: [] }
  }

  await rejectPostgresDisbursement(docId, 'ไม่อนุมัติคำขอ')

  const rejectHeader = executedStatements.find(
    (s) => s.sql.includes('UPDATE public.disbursements') && s.sql.includes("status = 'rejected'")
  )
  assert.ok(rejectHeader, 'header transitions to rejected so the database can close the pending lines')
})

test('partial approval allocates a document number only when final rejection closes the review', async () => {
  const docId = '11111111-1111-4111-8111-111111111111'
  const first = { id: '22222222-2222-4222-8222-222222222222', item_id: '33333333-3333-4333-8333-333333333333', status: 'pending', requested_qty: 1, issued_qty: 0 }
  const last = { ...first, id: '44444444-4444-4444-8444-444444444444', item_id: '55555555-5555-4555-8555-555555555555' }
  const statements: string[] = []
  activeQueryHandler = ({ sql }) => {
    statements.push(sql)
    if (sql.includes('SELECT * FROM public.disbursements')) {
      return { rows: [{ id: docId, status: 'pending_approval', transaction_type: 'material_issue', document_no: null, fiscal_year: null }] }
    }
    if (sql.includes('SELECT * FROM public.disbursement_items')) return { rows: [first, last] }
    if (sql.includes('sum(delta)')) return { rows: [{ disbursement_item_id: first.id, net: -1 }] }
    if (sql.includes('public.inventory_registry') || sql.includes('SELECT i.*')) {
      return { rows: [{ id: first.item_id, item_type: 'material', status: 'active', quantity: 0 }] }
    }
    if (sql.includes('RETURNING quantity')) return { rows: [{ quantity: 10 }] }
    if (sql.includes('RETURNING current_val')) return { rows: [{ current_val: 1 }] }
    return { rows: [] }
  }

  const partial = await partialApprovePostgresDisbursement({ disbursement_id: docId, line_ids: [first.id] })
  assert.equal(partial.status, 'pending_approval')
  assert.equal(partial.document_no, undefined)
  assert.ok(!statements.some((sql) => sql.includes('disbursement_sequences') || sql.includes('UPDATE public.materials')))
  assert.doesNotMatch(statements.find((sql) => sql.includes('UPDATE public.disbursements')) ?? '', /document_no|fiscal_year/)

  first.status = 'issued'
  first.issued_qty = 1
  statements.length = 0
  const closed = await partialRejectPostgresDisbursement({ disbursement_id: docId, line_ids: [last.id], reason: 'Declined' })
  assert.equal(closed.status, 'confirmed')
  assert.ok(statements.some((sql) => sql.includes('disbursement_sequences')))
  const header = statements.find((sql) => sql.includes('UPDATE public.disbursements')) ?? ''
  assert.match(header, /document_no.*fiscal_year/)
  assert.match(header, /confirmed_at.*confirmed_by/)
  assert.doesNotMatch(header, /reversal_reason/)
})

// ==========================================
// BUG-07: getPostgresDisbursements scopes to created_by for non-admin
// ==========================================
test('BUG-07: getPostgresDisbursements scopes results to created_by for non-admin users', async () => {
  const userId = '11111111-1111-4111-8111-111111111111'
  mockProfile = {
    id: userId,
    role: 'user',
    is_active: true,
  }

  const executedStatements: { sql: string; params: unknown[] }[] = []

  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('SELECT count(*)::int as count FROM public.disbursements')) {
      return { rows: [{ count: 0 }] }
    }
    if (query.sql.includes('active_borrow')) {
      return { rows: [{ total: 0, active_borrow: 0, draft: 0, confirmed: 0, pending_approval: 0 }] }
    }
    return { rows: [] }
  }

  await getPostgresDisbursements()
  for (const statement of executedStatements) {
    assert.ok(statement.sql.includes('d.created_by ='), 'query scopes to created_by')
    assert.ok(statement.params.includes(userId), 'param includes user id')
  }
  const numbered = executedStatements.find((statement) => statement.sql.includes('row_number()'))
  assert.match(numbered?.sql ?? '', /FROM public\.disbursements d WHERE d\.created_by = \$\d+::uuid\s*\) d/)
})

// ==========================================
// BUG-08: returnPostgresCustody blocks return when item is in active borrow
// ==========================================
test('BUG-08: returnPostgresCustody blocks return when item is in active borrow document', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const itemId = '33333333-3333-4333-8333-333333333333'

  activeQueryHandler = (query) => {
    if (query.sql.includes('SELECT id, item_type, item_name')) {
      return {
        rows: [
          {
            id: itemId,
            item_type: 'asset',
            item_name: 'กล้อง',
            asset_no: 'CAM-01',
            is_central: false,
            responsible_person: 'เจ้าหน้าที่ ก',
            status: 'active',
            location_id: null,
            note: null,
          },
        ],
      }
    }
    if (query.sql.includes('FROM public.disbursement_items di') && query.sql.includes('JOIN public.disbursements d')) {
      // Item is active in a borrow document!
      return { rows: [{ id: 'doc-1', document_no: 'DIS-2569-0010' }] }
    }
    return { rows: [] }
  }

  await assert.rejects(
    returnPostgresCustody({
      item_id: itemId,
      condition: 'normal',
      reason: 'คืนเข้าคลัง',
    }),
    /ครุภัณฑ์นี้อยู่ระหว่างการยืมตามเอกสาร/
  )
})

// ==========================================
// BUG-09: reversePostgresDisbursement preserves is_central=false when preceding personal custodian exists
// ==========================================
test('BUG-09: reversePostgresDisbursement preserves is_central=false when preceding personal custodian exists', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const docId = '11111111-1111-4111-8111-111111111111'
  const lineId = '22222222-2222-4222-8222-222222222222'
  const itemId = '33333333-3333-4333-8333-333333333333'
  const executedStatements: { sql: string; params: unknown[] }[] = []

  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('SELECT * FROM public.disbursements WHERE id =')) {
      return {
        rows: [
          {
            id: docId,
            status: 'confirmed',
            transaction_type: 'asset_handover',
            recipient_name: 'ผู้รับใหม่',
          },
        ],
      }
    }
    if (query.sql.includes('count(*)::int as count FROM public.disbursement_items')) {
      return { rows: [{ count: 0 }] }
    }
    if (query.sql.includes('SELECT count(*)::int AS count') && query.sql.includes('JOIN public.disbursements')) {
      return { rows: [{ count: 0 }] }
    }
    if (query.sql.includes('SELECT * FROM public.disbursement_items WHERE disbursement_id =')) {
      return {
        rows: [
          {
            id: lineId,
            item_id: itemId,
            status: 'issued',
            issued_qty: 1,
          },
        ],
      }
    }
    if (query.sql.includes('public.inventory_registry')) {
      return { rows: [{ id: itemId, item_type: 'asset' }] }
    }
    if (query.sql.includes('SELECT id, item_type, quantity, responsible_person, note FROM')) {
      return {
        rows: [
          {
            id: itemId,
            item_type: 'asset',
            quantity: 1,
            responsible_person: 'ผู้รับใหม่',
            note: '',
          },
        ],
      }
    }
    if (query.sql.includes('SELECT c.from_responsible FROM public.asset_custody_logs')) {
      return { rows: [{ from_responsible: 'เจ้าหน้าที่ เดิม' }] }
    }
    return { rows: [] }
  }

  await reversePostgresDisbursement({
    disbursement_id: docId,
    reason: 'ยกเลิกการส่งมอบ',
  })
  const reversal = executedStatements.find((s) => s.sql.includes('private.apply_asset_custody_event'))
  assert.ok(reversal)
  assert.ok(reversal.sql.includes("'reversal'"))
  assert.deepEqual(reversal.params, [itemId, lineId, 1, 'ยกเลิกการส่งมอบ', ''])
})

// ==========================================
// BUG-11: mutatePostgresItems prevents status change when items in pending/borrow
// ==========================================
test('BUG-11: mutatePostgresItems prevents status change to non-active when items are in pending or active borrow', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const itemId = '33333333-3333-4333-8333-333333333333'

  activeQueryHandler = (query) => {
    if (query.sql.includes('deleted_at is null limit 1')) {
      return { rows: [{ id: itemId }] }
    }
    if (query.sql.includes('FROM public.disbursement_items di') || query.sql.includes('disbursement_items')) {
      return { rows: [{ item_id: itemId }] }
    }
    return { rows: [] }
  }

  const res = await mutatePostgresItems([itemId], 'update', { status: 'inactive' })
  assert.ok(res.error, 'should return error')
  assert.ok(
    res.error.includes('ไม่สามารถเปลี่ยนสถานะเป็นไม่พร้อมใช้งานได้'),
    `expected blocked status error message, received: ${res.error}`
  )
  const custody = await mutatePostgresItems([itemId], 'update', { responsible_person: '' })
  assert.match(custody.error ?? '', /ไม่สามารถเปลี่ยนผู้ถือครอง/)
})

// ==========================================
// BUG-12: pgDeleteTableRow routes item/material deletions through archive logic
// ==========================================
test('BUG-12: pgDeleteTableRow routes item/material deletions through archive logic', async () => {
  mockProfile = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'admin',
    is_active: true,
  }
  const itemId = '33333333-3333-4333-8333-333333333333'
  const executedStatements: { sql: string; params: unknown[] }[] = []

  activeQueryHandler = (query) => {
    executedStatements.push(query)
    if (query.sql.includes('FROM public.profiles') || query.sql.includes('public.profiles')) {
      return { rows: [{ id: mockProfile.id }] }
    }
    if (query.sql.includes('SELECT count(*)::int as count FROM public.disbursement_items')) {
      return { rows: [{ count: 0 }] }
    }
    if (query.sql.includes('select id from') && query.sql.includes('deleted_at is null')) {
      return { rows: [{ id: itemId }] }
    }
    if (query.sql.toLowerCase().includes('update') && query.sql.includes('deleted_at = now()')) {
      return { rows: [{ id: itemId, image_url: null }] }
    }
    return { rows: [] }
  }

  const res = await pgDeleteTableRow('items', itemId)
  assert.equal(res.success, true, 'delete row succeeded')

  const softDelete = executedStatements.find(
    (s) => s.sql.toLowerCase().includes('update') && s.sql.includes('deleted_at')
  )
  assert.ok(softDelete, 'delegated to archive and executed soft delete (UPDATE deleted_at), not hard DELETE')
})
