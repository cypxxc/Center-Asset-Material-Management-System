import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { GroupedTransactionsTable } from '../../features/disbursements/components/grouped-transactions-table'
import type { DisbursementRow } from '../../features/disbursements/types'

const document: DisbursementRow = {
  id: 'request-1', document_no: 'REQ-001', fiscal_year: 2569,
  transaction_type: 'material_issue', recipient_name: 'ผู้ขอทดสอบ',
  department_name: 'งานบริหาร', purpose: 'ใช้ในการประชุม', status: 'pending_approval',
  due_date: null, confirmed_at: null, confirmed_by: null, reversal_reason: null,
  reversed_at: null, reversed_by: null, created_by: null,
  created_at: '2026-11-15T00:00:00Z', updated_at: '2026-11-15T00:00:00Z',
  requested_items: [],
}

test('requester can read the rejection reason from expanded request details', () => {
  try {
    const view = render(<GroupedTransactionsTable documents={[{ ...document, status: 'rejected', reversal_reason: 'พัสดุไม่เพียงพอ' }]} userRole="user" />)
    fireEvent.click(view.getByRole('button', { expanded: false }))
    assert.ok(view.queryByText('พัสดุไม่เพียงพอ'))
  } finally { cleanup() }
})

test('approval history row opens details by clicking a cell and using the keyboard', () => {
  try {
    const view = render(<GroupedTransactionsTable documents={[{ ...document, status: 'confirmed' }]} userRole="admin" historyMode />)
    const cell = view.getByText('ผู้ขอทดสอบ')
    const row = cell.closest('tr')!
    fireEvent.click(cell)
    assert.equal(view.queryAllByRole('region').length, 1)
    assert.equal(row.getAttribute('aria-expanded'), 'true')
    fireEvent.keyDown(row, { key: 'Enter' })
    assert.equal(view.queryAllByRole('region').length, 0)
    fireEvent.keyDown(row, { key: ' ' })
    assert.equal(view.queryAllByRole('region').length, 1)
    // The disclosure button must toggle once, without bubbling to the row.
    fireEvent.click(view.getByRole('button', { expanded: true }))
    assert.equal(view.queryAllByRole('region').length, 0)
  } finally { cleanup() }
})

test('approval workspace keeps disclosure-only expansion', () => {
  try {
    const view = render(<GroupedTransactionsTable documents={[document]} userRole="admin" />)
    fireEvent.click(view.getByText('ผู้ขอทดสอบ'))
    assert.equal(view.queryAllByRole('region').length, 0)
    const cancel = view.getByRole('button', { name: 'ยกเลิก' })
    fireEvent.keyDown(cancel, { key: 'Enter' })
    assert.equal(view.queryAllByRole('region').length, 0)
    fireEvent.click(cancel)
    assert.equal(view.queryAllByRole('region').length, 0)
  } finally { cleanup() }
})
