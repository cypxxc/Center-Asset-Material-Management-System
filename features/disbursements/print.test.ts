import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDisbursementVoucherHtml } from './print-generator'
import type { DisbursementRow, DisbursementItemRow } from './types'

test('generateDisbursementVoucherHtml formats immutable snapshot data and Thai Sarabun print page', () => {
  const doc: DisbursementRow = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    document_no: 'DIS-2570-0042',
    fiscal_year: 2570,
    transaction_type: 'material_issue',
    recipient_name: 'นายสมชาย สายตรวจ',
    department_name: 'ฝ่ายพัสดุและสารสนเทศ',
    purpose: 'ใช้สำหรับกิจกรรมฝึกอบรมประจำปี 2570',
    status: 'confirmed',
    due_date: null,
    confirmed_at: '2026-10-27T10:00:00.000Z',
    confirmed_by: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    reversal_reason: null,
    reversed_at: null,
    reversed_by: null,
    created_by: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    created_at: '2026-10-27T09:00:00.000Z',
    updated_at: '2026-10-27T10:00:00.000Z',
  }

  const items: DisbursementItemRow[] = [
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      disbursement_id: doc.id,
      item_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      requested_qty: 10,
      issued_qty: 10,
      returned_qty: 0,
      item_name_snapshot: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
      asset_no_snapshot: null,
      serial_no_snapshot: null,
      brand_snapshot: 'Double A',
      model_snapshot: null,
      unit_name_snapshot: 'รีม',
      unit_price_snapshot: 135.5,
      category_name_snapshot: 'วัสดุสำนักงาน',
      location_name_snapshot: 'ห้องคลังพัสดุชั้น 2',
      status: 'issued',
    },
  ]

  const html = generateDisbursementVoucherHtml(doc, items)

  // Verify core voucher elements
  assert.ok(html.includes('DIS-2570-0042'))
  assert.ok(html.includes('นายสมชาย สายตรวจ'))
  assert.ok(html.includes('กลุ่มงาน:'))
  assert.ok(html.includes('ฝ่ายพัสดุและสารสนเทศ'))
  assert.ok(html.includes('กระดาษถ่ายเอกสาร A4 80 แกรม'))
  assert.ok(html.includes('135.50'))
  assert.ok(html.includes('1,355.00')) // Total line value
  assert.ok(html.includes('ผู้ขอเบิก/ผู้ยืม'))
  assert.ok(html.includes('ผู้มีอำนาจสั่งจ่าย'))
  assert.ok(html.includes('ผู้จ่ายพัสดุ'))
  assert.ok(html.includes('ผู้รับพัสดุ'))
  assert.ok(html.includes('A4 portrait'))
})
