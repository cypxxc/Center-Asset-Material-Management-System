import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, fireEvent } from '@testing-library/react'
import { GroupedTransactionsTable } from '../../features/disbursements/components/grouped-transactions-table'
import type { DisbursementRow } from '../../features/disbursements/types'

const document: DisbursementRow = {
  id: '00000000-0000-4000-8000-000000000001', document_no: null,
  fiscal_year: null, transaction_type: 'asset_borrow', recipient_name: 'ผู้ยืมตัวอย่าง',
  department_name: 'สำนักงาน', purpose: 'ประชุม', status: 'partially_returned',
  due_date: '2026-11-20', confirmed_at: '2026-11-12T00:00:00Z', confirmed_by: null,
  reversal_reason: null, reversed_at: null, reversed_by: null, created_by: null,
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z',
  requested_items: [1, 2, 3].map(n => ({
    line_id: `00000000-0000-4000-8000-00000000000${n}`, item_id: `asset-${n}`,
    item_name: `ครุภัณฑ์ ${n}`, asset_no: `ASSET-${n}`, requested_qty: 1,
    issued_qty: 1, returned_qty: n === 1 ? 1 : 0, status: n === 1 ? 'returned' : 'issued',
  })),
}

test('one parent expands to three independent asset rows and return progress', () => {
  const view = render(<GroupedTransactionsTable documents={[document]} userRole="admin" />)
  assert.equal(view.queryByText('ครุภัณฑ์ 1'), null)
  assert.ok(view.getByText('3 รายการ'))
  assert.ok(view.getByText(document.recipient_name))
  const expand = view.getByRole('button', { name: /ขยายรายการ/ })
  fireEvent.click(expand)
  assert.equal(expand.getAttribute('aria-expanded'), 'true')
  const table = view.getByRole('table', { name: 'รายการวัสดุในคำขอ' })
  assert.equal((table as HTMLTableElement).tBodies[0].rows.length, 3)
  assert.equal(view.getAllByRole('button', { name: /^คืน ASSET/ }).length, 2)
  assert.equal(view.queryByRole('button', { name: 'คืน ASSET-1' }), null)
  fireEvent.click(expand)
  assert.equal(view.queryByRole('table', { name: 'รายการวัสดุในคำขอ' }), null)
})

test('user can expand but cannot receive assets', () => {
  const view = render(<GroupedTransactionsTable documents={[document]} userRole="user" />)
  fireEvent.click(view.getByRole('button', { name: /ขยายรายการ/ }))
  assert.equal(view.queryAllByRole('button', { name: /^คืน ASSET/ }).length, 0)
})

test('approval reference shows the requester name without a redundant recipient column', () => {
  const view = render(<GroupedTransactionsTable documents={[{ ...document, requester_name: 'ผู้ขอตัวอย่าง' }]} userRole="user" />)
  assert.ok(view.getByRole('columnheader', { name: 'ชื่อผู้ขอ' }))
  assert.ok(view.getByText('ผู้ขอตัวอย่าง'))
  assert.equal(view.queryByRole('link'), null)
  assert.equal(view.queryByRole('columnheader', { name: 'ผู้ยืม / ผู้รับ' }), null)
  assert.equal(view.queryByText(document.recipient_name), null)
  assert.equal(view.getAllByRole('columnheader').length, 7)
  assert.equal(view.queryByRole('columnheader', { name: 'ID' }), null)
})
