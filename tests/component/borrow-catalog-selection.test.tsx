import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, fireEvent, waitFor } from '@testing-library/react'
import type { CentralAvailableItem } from '../../features/disbursements/types'

let submit = async (input: { item_ids: string[] }) => { void input; return { ok: false, success: false, error: 'fixture' } }
const actionPath = require.resolve('../../features/disbursements/actions')
require.cache[actionPath] = { id: actionPath, filename: actionPath, loaded: true, exports: { submitBorrowRequest: (input: { item_ids: string[] }) => submit(input) } } as NodeJS.Module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BorrowCatalogView } = require('../../features/disbursements/components/borrow-catalog-view') as typeof import('../../features/disbursements/components/borrow-catalog-view')

const items: CentralAvailableItem[] = Array.from({ length: 21 }, (_, n) => ({ id: `asset-${n}`, item_name: `Asset ${n}`, item_type: 'asset', asset_no: `CODE-${n}`, serial_no: null, brand: null, model: null, quantity: 1, image_url: null, category: null, unit_name: null, location_name: null }))

test('card selection survives filters and cannot exceed 20', () => {
  const view = render(<BorrowCatalogView items={items} searchQuery="" />)
  fireEvent.click(view.getByRole('button', { name: 'เลือก Asset 0' }))
  assert.equal(view.getByRole('button', { name: 'เลือก Asset 0' }).getAttribute('aria-pressed'), 'true')
  view.rerender(<BorrowCatalogView items={items} searchQuery="CODE-1" />)
  assert.ok(view.getByText(/นอกผลการค้นหา 1 รายการ/))
  fireEvent.click(view.getByRole('button', { name: 'เลือก Asset 1' }))
  view.rerender(<BorrowCatalogView items={items} searchQuery="" />)
  for (const button of view.getAllByRole('button', { name: /^เลือก Asset/ })) {
    if (button.getAttribute('aria-pressed') !== 'true') fireEvent.click(button)
  }
  assert.equal(view.getAllByRole('button', { name: /^เลือก Asset/ }).filter(el => el.getAttribute('aria-pressed') === 'true').length, 20)
  fireEvent.click(view.getByRole('button', { name: 'ล้างการเลือก' }))
  assert.equal(view.getAllByRole('button', { name: /^เลือก Asset/ }).filter(el => el.getAttribute('aria-pressed') === 'true').length, 0)
})

test('bulk submit sends one grouped request and retains selection on server failure', async () => {
  const previous = submit
  const calls: { item_ids: string[] }[] = []
  submit = async (input: { item_ids: string[] }) => { calls.push(input); return { ok: false, success: false, error: 'รายการถูกยืมแล้ว' } }
  try {
    const view = render(<BorrowCatalogView items={items.slice(0, 3)} searchQuery="" />)
    for (const button of view.getAllByRole('button', { name: /^เลือก Asset/ })) fireEvent.click(button)
    fireEvent.click(view.getByRole('button', { name: 'สร้างคำขอรวม' }))
    fireEvent.change(view.getByLabelText(/วัตถุประสงค์/), { target: { value: 'ประชุม' } })
    fireEvent.click(view.getByRole('button', { name: 'ยืนยันคำขอยืม' }))
    await waitFor(() => assert.equal(calls.length, 1))
    assert.deepEqual(calls[0].item_ids, ['asset-0', 'asset-1', 'asset-2'])
    await waitFor(() => assert.ok(view.getByRole('alert')))
    assert.equal(view.getByRole('button', { name: 'เลือก Asset 0' }).getAttribute('aria-pressed'), 'true')
  } finally { submit = previous }
})
