import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render } from '@testing-library/react'
import { GroupedTransactionsTable } from '../../features/disbursements/components/grouped-transactions-table'
import { ApprovalRowActions } from '../../features/disbursements/components/approval-row-actions'
import type { DisbursementRow } from '../../features/disbursements/types'

test('admin can receive a future-due borrowed asset from both document and line controls', () => {
  const doc = { id: '00000000-0000-4000-8000-000000000001', transaction_type: 'asset_borrow', recipient_name: 'ผู้ยืม', status: 'active_borrow', due_date: '2099-01-01', created_at: '2026-11-01T00:00:00Z', requested_items: [{ line_id: 'line', item_id: 'asset', item_name: 'กล้อง', asset_no: 'A1', requested_qty: 1, issued_qty: 1, returned_qty: 0, status: 'issued' }] } as DisbursementRow
  const view = render(<GroupedTransactionsTable documents={[doc]} userRole="admin" />)
  assert.ok(view.getByRole('button', { name: 'คืน' }))
  fireEvent.click(view.getByRole('button', { name: /ขยายรายการ/ }))
  assert.ok(view.getByRole('button', { name: 'คืน A1' }))
})

test('stale pending borrowing exposes a replacement due date before approval', () => {
  const view = render(<ApprovalRowActions doc={{ id: 'old', status: 'pending_approval', recipient_name: 'ผู้ยืม', transaction_type: 'asset_borrow', purpose: 'งาน', due_date: '2000-01-01' }} />)
  assert.ok(view.getByLabelText('กำหนดส่งคืนใหม่'))
  assert.ok((view.getByRole('button', { name: 'ยืนยัน' }) as HTMLButtonElement).disabled)
  fireEvent.change(view.getByLabelText('กำหนดส่งคืนใหม่'), { target: { value: '2099-01-01' } })
  assert.equal((view.getByRole('button', { name: 'ยืนยัน' }) as HTMLButtonElement).disabled, false)
})

