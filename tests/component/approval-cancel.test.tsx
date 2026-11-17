import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

const calls: unknown[] = []
const actionsPath = require.resolve('../../features/disbursements/actions')
require.cache[actionsPath] = { id: actionsPath, filename: actionsPath, loaded: true, exports: {
  reverseDisbursement: async (input: unknown) => { calls.push(input); return { ok: true } },
  rejectDisbursement: async () => { throw new Error('must reverse approved documents') },
  cancelDisbursementDraft: async () => { throw new Error('must reverse approved documents') },
  confirmDisbursement: async () => ({ ok: true }),
} } as NodeJS.Module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApprovalRowMenu } = require('../../features/disbursements/components/approval-row-menu') as typeof import('../../features/disbursements/components/approval-row-menu')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApprovalRowActions } = require('../../features/disbursements/components/approval-row-actions') as typeof import('../../features/disbursements/components/approval-row-actions')

test('approved cancellation requires a reason and uses the existing reversal action', async () => {
  for (const status of ['confirmed', 'active_borrow'] as const) {
    calls.length = 0
    let complete = false
    const view = render(<ApprovalRowMenu doc={{ id: 'doc-1', status, recipient_name: 'ผู้ขอ', transaction_type: 'asset_borrow', purpose: '' }} disabled={false} onBusyChange={() => {}} onComplete={() => { complete = true }} />)
    fireEvent.click(view.getByRole('button', { name: 'ยกเลิกคำขอ' }))
    assert.equal(calls.length, 0)
    assert.ok(view.getByRole('alert').textContent?.includes('กรุณาระบุเหตุผล'))
    fireEvent.change(view.getByLabelText(/เหตุผลการยกเลิก/), { target: { value: 'ตรวจแล้วไม่มีของ' } })
    fireEvent.click(view.getByRole('button', { name: 'ยกเลิกคำขอ' }))
    await waitFor(() => assert.equal(complete, true))
    assert.deepEqual(calls, [{ disbursement_id: 'doc-1', reason: 'ตรวจแล้วไม่มีของ' }])
    cleanup()
  }
})

test('cancel stays available after approval but not after returns or cancellation', () => {
  for (const status of ['confirmed', 'active_borrow', 'returned', 'partially_returned', 'reversed', 'cancelled'] as const) {
    const view = render(<ApprovalRowActions doc={{ id: 'doc-1', status, recipient_name: 'ผู้ขอ', transaction_type: 'asset_borrow', purpose: '' }} />)
    const button = view.getByRole('button', { name: 'ยกเลิก' }) as HTMLButtonElement
    assert.equal(button.disabled, !['confirmed', 'active_borrow'].includes(status))
    cleanup()
  }
})
