import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAuditDiff,
  formatAuditValue,
  formatJsonForDisplay,
  getAuditActionLabel,
  getAuditFieldLabel,
  getAuditTableLabel,
  summarizeAuditPayload,
} from './format'

test('translates audit action labels with fallback to raw action', () => {
  assert.equal(getAuditActionLabel('create'), 'สร้างข้อมูล')
  assert.equal(getAuditActionLabel('update'), 'แก้ไขข้อมูล')
  assert.equal(getAuditActionLabel('delete'), 'ลบข้อมูล')
  assert.equal(getAuditActionLabel('restore'), 'กู้คืนข้อมูล')
  assert.equal(getAuditActionLabel('hard_delete'), 'ลบถาวร')
  assert.equal(getAuditActionLabel('sql_query'), 'เรียกใช้ SQL')
  assert.equal(getAuditActionLabel('unknown_action'), 'unknown_action')
})

test('translates audit target table labels with fallback to raw table name', () => {
  assert.equal(getAuditTableLabel('items'), 'รายการพัสดุ')
  assert.equal(getAuditTableLabel('profiles'), 'บัญชีผู้ใช้')
  assert.equal(getAuditTableLabel('categories'), 'หมวดหมู่')
  assert.equal(getAuditTableLabel('locations'), 'สถานที่')
  assert.equal(getAuditTableLabel('units'), 'หน่วยนับ')
  assert.equal(getAuditTableLabel('audit_logs'), 'ประวัติการทำรายการ')
  assert.equal(getAuditTableLabel('custom_table'), 'custom_table')
})

test('translates audit field labels with fallback to raw field name', () => {
  assert.equal(getAuditFieldLabel('item_name'), 'ชื่อพัสดุครุภัณฑ์')
  assert.equal(getAuditFieldLabel('unit_price'), 'ราคาต่อหน่วย')
  assert.equal(getAuditFieldLabel('target_table'), 'ตารางเป้าหมาย')
  assert.equal(getAuditFieldLabel('unknown_field'), 'unknown_field')
})

test('formats known audit values for Thai display', () => {
  assert.equal(formatAuditValue('status', 'waiting_repair'), 'รอซ่อม')
  assert.equal(formatAuditValue('item_type', 'asset'), 'ครุภัณฑ์')
  assert.equal(formatAuditValue('role', 'staff'), 'เจ้าหน้าที่')
  assert.equal(formatAuditValue('is_active', true), 'เปิดใช้งาน')
  assert.equal(formatAuditValue('deleted_at', null), 'ไม่มีข้อมูล')
  assert.equal(formatAuditValue('quantity', 12), '12')
  assert.equal(formatAuditValue('new_data', { query: 'select 1' }), '{ "query": "select 1" }')
})

test('buildAuditDiff returns only changed fields and ignores updated_at by default', () => {
  const diff = buildAuditDiff(
    {
      item_name: 'โต๊ะทำงาน',
      status: 'active',
      quantity: 1,
      updated_at: '2026-07-01T00:00:00.000Z',
    },
    {
      item_name: 'โต๊ะทำงาน',
      status: 'waiting_repair',
      quantity: 3,
      updated_at: '2026-07-02T00:00:00.000Z',
    },
  )

  assert.deepEqual(diff, [
    {
      key: 'status',
      label: 'สถานะพัสดุ',
      oldValue: 'ใช้งานอยู่',
      newValue: 'รอซ่อม',
    },
    {
      key: 'quantity',
      label: 'จำนวน',
      oldValue: '1',
      newValue: '3',
    },
  ])
})

test('buildAuditDiff handles create-style payloads with only new data', () => {
  const diff = buildAuditDiff(null, {
    item_name: 'เครื่องพิมพ์',
    item_type: 'asset',
  })

  assert.deepEqual(diff, [
    {
      key: 'item_name',
      label: 'ชื่อพัสดุครุภัณฑ์',
      oldValue: 'ไม่มีข้อมูล',
      newValue: 'เครื่องพิมพ์',
    },
    {
      key: 'item_type',
      label: 'ประเภทสิ่งของ',
      oldValue: 'ไม่มีข้อมูล',
      newValue: 'ครุภัณฑ์',
    },
  ])
})

test('summarizeAuditPayload returns changed field count or raw JSON fallback text', () => {
  assert.equal(
    summarizeAuditPayload({ status: 'active' }, { status: 'waiting_repair' }),
    'เปลี่ยนแปลง 1 ฟิลด์',
  )
  assert.equal(summarizeAuditPayload({ status: 'active' }, { status: 'active' }), 'ดูรายละเอียด JSON')
  assert.equal(summarizeAuditPayload(null, { query: 'select 1' }), 'เปลี่ยนแปลง 1 ฟิลด์')
})

test('formatJsonForDisplay produces stable pretty JSON and handles null', () => {
  assert.equal(formatJsonForDisplay({ status: 'active' }), '{\n  "status": "active"\n}')
  assert.equal(formatJsonForDisplay(null), 'null')
})
