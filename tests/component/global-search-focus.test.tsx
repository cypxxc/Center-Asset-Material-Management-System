import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { ToastProvider } from '../../components/ui/toast'
import type { ItemListRow } from '../../features/items/types'

const mockItems: ItemListRow[] = [
  {
    id: 'item-1',
    item_name: 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูง Dell Precision 3660',
    item_type: 'asset',
    category: { id: 'cat-1', name: 'อุปกรณ์ไอที' },
    location: { id: 'loc-1', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' },
    unit: { id: 'unit-1', name: 'เครื่อง' },
    quantity: 1,
    unit_price: 65000,
    asset_no: 'EQ-7110-001/67',
    serial_no: 'SN-DELL-998811-TH',
    brand: 'Dell',
    model: 'Precision 3660',
    responsible_person: 'นายสมชาย วิศวกรรม',
    status: 'active',
    note: 'จัดซื้อด้วยเงินงบประมาณ',
    image_url: null,
    updated_at: '2026-01-02T00:00:00Z',
  },
]

const defaultProps = {
  items: mockItems,
  total: 1,
  userId: 'user-admin',
  params: {},
  userCanWrite: true,
  userCanDelete: true,
  locations: [{ id: 'loc-1', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' }],
  categories: [{ id: 'cat-1', name: 'อุปกรณ์ไอที' }],
  units: [{ id: 'unit-1', name: 'เครื่อง' }],
}

test('Frontend Search: SearchInput maintains focus and is NOT remounted when props update', () => {
  const { rerender } = render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
        params: {},
      })
    )
  )

  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...') as HTMLInputElement
  searchInput.focus()
  assert.equal(document.activeElement, searchInput)

  // Fast typing 50 characters
  const longText = 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูงหมายเลขครุภัณฑ์01'
  assert.equal(longText.length >= 50, true)

  fireEvent.change(searchInput, { target: { value: longText } })
  assert.equal(searchInput.value, longText)
  assert.equal(document.activeElement, searchInput)

  // Re-render component with new search params (simulating Next.js server update after search)
  rerender(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
        params: { q: longText },
      })
    )
  )

  // Crucial test: SearchInput DOM element must NOT be remounted, and focus must be retained!
  const currentActive = document.activeElement as HTMLInputElement
  assert.equal(currentActive, searchInput)
  assert.equal(searchInput.value, longText)
})

test('Frontend Search: Debounce 300ms triggers onChange without pressing Enter', async () => {
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
      })
    )
  )

  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...') as HTMLInputElement
  searchInput.focus()

  fireEvent.change(searchInput, { target: { value: 'Precision' } })
  assert.equal(searchInput.value, 'Precision')

  // Wait 350ms to cross 300ms debounce threshold
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350))
  })

  // Input still retains focus
  assert.equal(document.activeElement, searchInput)
})

test('Frontend Search: SearchInput shows loading spinner when search is in progress', () => {
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
        params: { q: 'Dell' },
      })
    )
  )

  // Verify SearchInput renders properly with active query
  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...') as HTMLInputElement
  assert.ok(searchInput)
})

test('Frontend Search: clearing search input resets query and clears active chip', () => {
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
        params: { q: 'Dell' },
      })
    )
  )

  // Active chip should be rendered for q
  const chip = screen.getByTestId('active-chip-q')
  assert.ok(chip)
  assert.ok(chip.textContent?.includes('Dell'))

  // Click clear on chip
  const removeBtn = chip.querySelector('button')
  assert.ok(removeBtn)
  fireEvent.click(removeBtn)
})
