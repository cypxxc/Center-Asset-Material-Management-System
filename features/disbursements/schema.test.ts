import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disbursementDraftSchema,
  updateDisbursementDraftSchema,
  cancelDisbursementDraftSchema,
  disbursementListParamsSchema,
  returnItemSchema,
  reverseDisbursementSchema,
} from './schema'
import { computeThaiFiscalYear } from './fiscal-year'
import { canWrite } from '@/lib/permissions'

test('disbursementDraftSchema validates material issue and requires items', () => {
  const valid = {
    transaction_type: 'material_issue',
    recipient_name: 'สมชาย สายตรวจ',
    department_name: 'ฝ่ายพัสดุ',
    purpose: 'ใช้สำหรับงานจัดประชุมประจำปี',
    items: [
      {
        item_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        requested_qty: 5,
      },
    ],
  }
  const parsed = disbursementDraftSchema.parse(valid)
  assert.equal(parsed.transaction_type, 'material_issue')
  assert.equal(parsed.items.length, 1)

  // Empty items rejected
  assert.throws(() => {
    disbursementDraftSchema.parse({ ...valid, items: [] })
  }, /ต้องมีรายการสิ่งของอย่างน้อย 1 รายการ/)

  // Empty department_name rejected
  assert.throws(() => {
    disbursementDraftSchema.parse({ ...valid, department_name: '   ' })
  }, /กรุณาระบุกลุ่มงาน/)

  // Negative or zero quantity rejected
  assert.throws(() => {
    disbursementDraftSchema.parse({
      ...valid,
      items: [{ item_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', requested_qty: 0 }],
    })
  }, /จำนวนต้องมากกว่า 0/)
})

test('disbursementDraftSchema requires due_date for asset_borrow', () => {
  const borrowWithoutDue = {
    transaction_type: 'asset_borrow',
    recipient_name: 'สมชาย สายตรวจ',
    department_name: 'ฝ่ายพัสดุ',
    purpose: 'ยืมใช้งานภาคสนาม',
    items: [
      {
        item_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        requested_qty: 1,
      },
    ],
  }

  assert.throws(() => {
    disbursementDraftSchema.parse(borrowWithoutDue)
  }, /กรุณาระบุกำหนดส่งคืนสำหรับรายการยืมครุภัณฑ์/)

  const borrowWithDue = {
    ...borrowWithoutDue,
    due_date: '2026-11-30',
  }
  const parsed = disbursementDraftSchema.parse(borrowWithDue)
  assert.equal(parsed.due_date, '2026-11-30')
})

test('returnItemSchema validates condition and positive quantity', () => {
  const valid = {
    line_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    return_qty: 1,
    condition: 'normal',
    note: 'สภาพสมบูรณ์',
  }
  const parsed = returnItemSchema.parse(valid)
  assert.equal(parsed.condition, 'normal')

  assert.throws(() => {
    returnItemSchema.parse({ ...valid, return_qty: 0 })
  }, /จำนวนต้องมากกว่า 0/)

  assert.throws(() => {
    returnItemSchema.parse({ ...valid, condition: 'broken' })
  }, /กรุณาระบุสภาพพัสดุ/)
})

test('reverseDisbursementSchema requires non-empty reason', () => {
  const valid = {
    disbursement_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'กรอกรายการผิดแผนก ขอทำการยกเลิกเพื่อออกใหม่',
  }
  const parsed = reverseDisbursementSchema.parse(valid)
  assert.equal(parsed.reason, valid.reason)

  assert.throws(() => {
    reverseDisbursementSchema.parse({ ...valid, reason: '   ' })
  }, /กรุณาระบุเหตุผลการยกเลิก\/คืนสภาพ/)
})

test('computeThaiFiscalYear calculates correct fiscal year boundary (October shift)', () => {
  // September 2026 -> Fiscal Year 2569
  const sepDate = new Date('2026-09-30T10:00:00+07:00')
  assert.equal(computeThaiFiscalYear(sepDate), 2569)

  // October 2026 -> Fiscal Year 2570
  const octDate = new Date('2026-10-01T00:00:00+07:00')
  assert.equal(computeThaiFiscalYear(octDate), 2570)

  // Current Date in October 2026 -> Fiscal Year 2570
  const currentDate = new Date('2026-10-27T14:00:00+07:00')
  assert.equal(computeThaiFiscalYear(currentDate), 2570)
})

test('updateDisbursementDraftSchema validates draft id and required payload', () => {
  const valid = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    transaction_type: 'material_issue',
    recipient_name: 'สมชาย สายตรวจ',
    department_name: 'ฝ่ายพัสดุ',
    purpose: 'แก้ไขวัตถุประสงค์การใช้งาน',
    items: [
      {
        item_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        requested_qty: 2,
      },
    ],
  }
  const parsed = updateDisbursementDraftSchema.parse(valid)
  assert.equal(parsed.id, valid.id)
  assert.equal(parsed.purpose, valid.purpose)
})

test('disbursementListParamsSchema validates pagination and optional filters', () => {
  const parsed = disbursementListParamsSchema.parse({
    q: 'คอมพิวเตอร์',
    status: 'active_borrow',
    type: 'asset_borrow',
    page: '2',
    pageSize: '50',
  })
  assert.equal(parsed.q, 'คอมพิวเตอร์')
  assert.equal(parsed.status, 'active_borrow')
  assert.equal(parsed.type, 'asset_borrow')
  assert.equal(parsed.page, 2)
  assert.equal(parsed.pageSize, 50)

  // Clamp / default invalid values
  const defaulted = disbursementListParamsSchema.parse({})
  assert.equal(defaulted.page, 1)
  assert.equal(defaulted.pageSize, 20)
})

test('cancelDisbursementDraftSchema validates target id', () => {
  const parsed = cancelDisbursementDraftSchema.parse({
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  assert.equal(parsed.id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
})

test('disbursement RBAC permissions enforce writer vs viewer access', () => {
  assert.equal(canWrite('admin'), true, 'Admin must have write permissions')
  assert.equal(canWrite('staff'), true, 'Staff must have write permissions')
  assert.equal(canWrite('viewer'), false, 'Viewer must NOT have write permissions')
  assert.equal(canWrite(undefined), false, 'Anonymous must NOT have write permissions')
  assert.equal(canWrite(null), false, 'Null role must NOT have write permissions')
})
