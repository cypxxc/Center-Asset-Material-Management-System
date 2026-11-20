import '../setup/dom'
import 'next/dynamic'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AdminWorkQueueSummary } from '../../features/disbursements/admin-work-queue-types'

test('dashboard shares approval actions, blocks duplicate confirmation, preserves rejection reason and reports failure', async () => {
  // The real client component runs; only the mutating server-action boundary is substituted.
  const actionPath = require.resolve('../../features/disbursements/actions')
  const originalActions = require.cache[actionPath]
  const nav = require.cache[require.resolve('next/navigation')]!.exports
  const originalRouter = nav.useRouter
  const calls: { action: string; id: string; reason?: string }[] = []
  let refreshes = 0
  let fail = false
  nav.useRouter = () => ({ refresh: () => { refreshes++ } })
  require.cache[actionPath] = { id: actionPath, filename: actionPath, loaded: true, exports: {
    confirmDisbursement: async (id: string) => { calls.push({ action: 'confirm', id }); return fail ? { ok: false, error: 'จำนวนคงเหลือไม่เพียงพอ' } : { ok: true } },
    rejectDisbursement: async (id: string, reason?: string) => { calls.push({ action: 'reject', id, reason }); return { ok: true } },
    cancelDisbursementDraft: async () => { throw new Error('Pending requests must use rejection, not draft cancellation') },
  } } as NodeJS.Module

  const { GroupedTransactionsTable } = await import('../../features/disbursements/components/grouped-transactions-table')

  const dynamicPath = require.resolve('next/dynamic')
  const originalDynamic = require.cache[dynamicPath]
  const mockDynamic = () => {
    return function DynamicMock(props: React.ComponentProps<typeof GroupedTransactionsTable>) {
      return React.createElement(GroupedTransactionsTable, props)
    }
  }
  mockDynamic.default = mockDynamic
  require.cache[dynamicPath] = {
    id: dynamicPath,
    filename: dynamicPath,
    loaded: true,
    exports: mockDynamic,
  } as NodeJS.Module

  const viewPath = require.resolve('../../components/dashboard/dashboard-admin-work-queue-view')
  delete require.cache[viewPath]

  globalThis.getComputedStyle = window.getComputedStyle.bind(window)
  globalThis.MutationObserver = window.MutationObserver
  globalThis.CustomEvent = window.CustomEvent
  globalThis.NodeFilter = window.NodeFilter
  globalThis.Node = window.Node
  globalThis.Element = window.Element
  try {
    const { AdminWorkQueueView } = await import('../../components/dashboard/dashboard-admin-work-queue-view')
    const summary: AdminWorkQueueSummary = { asOf: '2026-11-12', pendingCount: 1, overdueCount: 0, items: [{
      id: '22222222-2222-4222-8222-222222222222', document_no: null, recipient_name: 'ผู้ขอทดสอบ', department_name: 'งานพัสดุ',
      kind: 'pending', transaction_type: 'material_issue', purpose: 'ใช้ในการปฏิบัติงาน', due_date: null, overdue_days: 0, created_at: '2026-11-10T00:00:00Z',
    }] }
    render(React.createElement(AdminWorkQueueView, { summary }))
    const confirm = screen.getByRole('button', { name: 'ยืนยัน' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => assert.equal(refreshes, 1))
    assert.deepEqual(calls, [{ action: 'confirm', id: summary.items[0].id }])
    assert.equal((confirm as HTMLButtonElement).disabled, true)
    cleanup()

    render(React.createElement(AdminWorkQueueView, { summary }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    assert.ok(await screen.findByRole('dialog', { name: 'ยกเลิกคำขอนี้?' }))
    assert.ok(screen.getByText('ใช้ในการปฏิบัติงาน'))
    fireEvent.change(screen.getByRole('textbox', { name: /เหตุผลการยกเลิก/ }), { target: { value: '  ขอข้อมูลเพิ่มเติม  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิกคำขอ' }))
    await waitFor(() => assert.equal(refreshes, 2))
    assert.deepEqual(calls[1], { action: 'reject', id: summary.items[0].id, reason: 'ขอข้อมูลเพิ่มเติม' })
    cleanup()

    fail = true
    render(React.createElement(AdminWorkQueueView, { summary }))
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }))
    await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /จำนวนคงเหลือไม่เพียงพอ/))
    assert.equal(refreshes, 2)
    assert.equal((screen.getByRole('button', { name: 'ยืนยัน' }) as HTMLButtonElement).disabled, false)
  } finally {
    cleanup()
    nav.useRouter = originalRouter
    if (originalActions) require.cache[actionPath] = originalActions; else delete require.cache[actionPath]
    if (originalDynamic) require.cache[dynamicPath] = originalDynamic; else delete require.cache[dynamicPath]
    delete require.cache[viewPath]
    delete require.cache[require.resolve('../../features/disbursements/components/grouped-transactions-table')]
    delete require.cache[require.resolve('../../features/disbursements/components/approval-row-actions')]
  }
})
