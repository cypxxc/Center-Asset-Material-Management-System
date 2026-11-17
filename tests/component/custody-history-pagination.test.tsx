/* eslint-disable @typescript-eslint/no-require-imports -- Replace server action exports before loading the client component. */
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render, waitFor } from '@testing-library/react'

test('custody history loads server pages and starts at page one when search changes', async () => {
  const actionsPath = require.resolve('../../features/disbursements/actions')
  require(actionsPath)
  const moduleEntry = require.cache[actionsPath]!
  const previous = moduleEntry.exports
  const actions = { ...previous }
  moduleEntry.exports = actions
  const calls: { page: number; q: string }[] = []
  const row = { id: 'event', item_name: 'เครื่องฉายภาพ', asset_no: 'ASSET-001', from_responsible: null, to_responsible: 'สมชาย', actor_name: 'ผู้ดูแล', created_at: '2026-11-01T00:00:00Z' }
  actions.loadCustodyForm = async () => ({ ok: true, data: { history: [row] } })
  actions.loadCustodyHistory = async (params: { page: number; q: string }) => {
    calls.push(params)
    return { ok: true, data: { rows: [row], total: 125, page: params.page, pageSize: 20, totalPages: 7 } }
  }
  try {
    const { CustodyHistoryPanel } = require('../../features/disbursements/components/custody-history-panel')
    const view = render(<CustodyHistoryPanel query="" revision={0} onAssign={() => {}} />)
    await waitFor(() => assert.ok(view.queryByText('แสดง 1–20 จาก 125 รายการ')))
    const footer = view.container.querySelector('footer')
    assert.ok(footer, 'pagination belongs in a fixed footer outside the scrolling content')
    assert.equal(footer.parentElement?.classList.contains('flex-col'), true)
    assert.equal(view.getByRole('button', { name: 'หน้า 1' }).getAttribute('aria-current'), 'page')
    assert.equal((view.getByRole('button', { name: 'หน้าก่อนหน้า' }) as HTMLButtonElement).disabled, true)
    fireEvent.click(view.getByRole('button', { name: 'หน้าถัดไป' }))
    await waitFor(() => assert.equal(calls.at(-1)?.page, 2))
    await waitFor(() => assert.ok(view.queryByText('แสดง 21–40 จาก 125 รายการ')))
    fireEvent.click(view.getByRole('button', { name: 'หน้า 7' }))
    await waitFor(() => assert.equal(calls.at(-1)?.page, 7))
    await waitFor(() => assert.ok(view.queryByText('แสดง 121–125 จาก 125 รายการ')))
    assert.equal((view.getByRole('button', { name: 'หน้าถัดไป' }) as HTMLButtonElement).disabled, true)
    view.rerender(<CustodyHistoryPanel query="สมชาย" revision={0} onAssign={() => {}} />)
    await waitFor(() => assert.deepEqual(calls.at(-1), { page: 1, q: 'สมชาย' }))
    view.unmount()
  } finally { moduleEntry.exports = previous }
})
