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

test('custody history shows return action for active custodian rows and opens return modal', async () => {
  const panelPath = require.resolve('../../features/disbursements/components/custody-history-panel')
  delete require.cache[panelPath]
  const actionsPath = require.resolve('../../features/disbursements/actions')
  require(actionsPath)
  const moduleEntry = require.cache[actionsPath]!
  const previous = moduleEntry.exports
  const actions = { ...previous }
  moduleEntry.exports = actions

  const rows = [
    {
      id: 'event-1',
      action: 'ASSIGN_CUSTODY',
      item_id: 'a0000000-0000-4000-8000-000000000001',
      item_name: 'โต๊ะทำงาน',
      asset_no: 'ASSET-001',
      from_responsible: null,
      to_responsible: 'สมชาย',
      actor_name: 'ผู้ดูแล',
      created_at: '2026-11-01T00:00:00Z',
      can_return: true,
      is_returned: false,
    },
    {
      id: 'event-2',
      action: 'ASSIGN_CUSTODY',
      item_id: 'a0000000-0000-4000-8000-000000000002',
      item_name: 'เก้าอี้สำนักงาน',
      asset_no: 'ASSET-002',
      from_responsible: 'สมชาย',
      to_responsible: 'ส่วนกลาง',
      actor_name: 'ผู้ดูแล',
      created_at: '2026-11-02T00:00:00Z',
      can_return: false,
      is_returned: true,
    },
  ]

  actions.loadCustodyHistory = async () => ({
    ok: true,
    data: { rows, total: 2, page: 1, pageSize: 20, totalPages: 1 },
  })
  actions.loadLocationsList = async () => ({
    ok: true,
    data: [{ id: 'loc-1', name: 'ห้องคลัง 1' }],
  })
  actions.loadOriginLocationAction = async () => ({
    ok: true,
    data: { id: 'loc-1', name: 'ห้องคลัง 1' },
  })

  let returnPayload: { item_id: string; condition: string } | null = null
  actions.returnCustody = async (params: { item_id: string; condition: string }) => {
    returnPayload = params
    return { ok: true }
  }

  try {
    const { CustodyHistoryPanel } = require('../../features/disbursements/components/custody-history-panel')
    const view = render(<CustodyHistoryPanel query="" revision={0} />)

    await waitFor(() => assert.ok(view.queryByText('จัดการ')))
    await waitFor(() => assert.ok(view.queryByText('รับคืนแล้ว')))

    const returnBtn = view.getByRole('button', { name: 'รับคืน' })
    assert.ok(returnBtn)

    fireEvent.click(returnBtn)
    await waitFor(() => assert.ok(returnPayload))
    assert.equal(returnPayload!.item_id, 'a0000000-0000-4000-8000-000000000001')
    assert.equal(returnPayload!.condition, 'normal')

    view.unmount()
  } finally {
    moduleEntry.exports = previous
  }
})
