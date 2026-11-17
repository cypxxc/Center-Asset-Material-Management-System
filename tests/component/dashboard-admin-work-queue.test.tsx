import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { AdminWorkQueueView } from '../../components/dashboard/dashboard-admin-work-queue-view'
import type { AdminWorkQueueSummary } from '../../features/disbursements/admin-work-queue-types'

const summary: AdminWorkQueueSummary = {
  asOf: '2026-11-12', pendingCount: 12, overdueCount: 1,
  items: [
    { id: '11111111-1111-4111-8111-111111111111', document_no: 'DIS-2570-00001', recipient_name: 'ผู้ยืมทดสอบ', department_name: 'งานพัสดุ', kind: 'overdue', transaction_type: 'asset_borrow', purpose: 'ทดสอบยืม', due_date: '2026-11-01', overdue_days: 11, created_at: '2026-10-01T00:00:00Z' },
    { id: '22222222-2222-4222-8222-222222222222', document_no: null, recipient_name: 'ผู้ขอทดสอบ', department_name: 'ฝ่ายบริหาร', kind: 'pending', transaction_type: 'material_issue', purpose: 'ทดสอบเบิกพัสดุ', due_date: null, overdue_days: 0, created_at: '2026-11-09T20:00:00Z' },
  ],
}

test('one admin work section shows true totals, full identifiers, and direct detail links', () => {
  render(React.createElement(AdminWorkQueueView, { summary }))
  assert.ok(screen.getByRole('heading', { name: 'รออนุมัติ' }))
  assert.equal(screen.getByRole('link', { name: 'ดูคำขอทั้งหมด' }).getAttribute('href'), '/disbursements?tab=requests&status=pending_approval')
  const rows = within(screen.getByRole('table')).getAllByRole('row')
  assert.ok(rows.length >= 2)
  assert.match(rows[1].textContent ?? '', /ผู้ขอทดสอบ/)
  assert.match(rows[1].textContent ?? '', /เบิก/)
  assert.ok(screen.getByRole('button', { name: 'ยืนยัน' }))
  assert.ok(screen.getByRole('button', { name: 'ยกเลิก' }))
})

test('empty queue explicitly says no outstanding work', () => {
  render(React.createElement(AdminWorkQueueView, { summary: { ...summary, items: [], pendingCount: 0, overdueCount: 0 } }))
  assert.ok(screen.getByText('ไม่มีรายการรออนุมัติ'))
  assert.equal(screen.queryByRole('table'), null)
})
