import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { ItemBatchWindow, saveItemWindow } from '../../features/items/batch-window'
import { normalizeItemListSearchParams } from '../../features/items/list-params'

// This component test exercises the inspector UI, not the live Supabase channel.
// Disable the channel so placeholder CI credentials cannot leave a realtime socket open.
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { ToastProvider } from '../../components/ui/toast'
import type { ItemListRow } from '../../features/items/types'

const mockItems: ItemListRow[] = [
  {
    id: 'item-1',
    item_name: 'โน้ตบุ๊ก Dell Latitude 5420',
    item_type: 'asset',
    category: { id: 'cat-1', name: 'อุปกรณ์ไอที' },
    location: { id: 'loc-1', name: 'ห้องทำงานชั้น 3' },
    unit: { id: 'unit-1', name: 'เครื่อง' },
    quantity: 1,
    unit_price: 32000,
    asset_no: 'EQ-2026-001',
    serial_no: 'SN-DELL-998811',
    brand: 'Dell',
    model: 'Latitude 5420',
    responsible_person: 'นายสมชาย วิศวกรรม',
    status: 'active',
    note: 'สภาพดี เบิกใช้งานเมื่อมกราคม 2026',
    image_url: null,
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'item-2',
    item_name: 'กระดาษ Double A A4 80gsm',
    item_type: 'material',
    category: { id: 'cat-2', name: 'เครื่องเขียนและวัสดุสำนักงาน' },
    location: { id: 'loc-2', name: 'ห้องเก็บของส่วนกลาง' },
    unit: { id: 'unit-2', name: 'รีม' },
    quantity: 50,
    unit_price: 135,
    asset_no: null,
    serial_no: null,
    brand: 'Double A',
    model: '80gsm',
    responsible_person: null,
    status: 'spare',
    note: null,
    image_url: null,
    updated_at: '2026-01-06T00:00:00Z',
  },
]

const defaultProps = {
  items: mockItems,
  total: 2,
  nextCursor: null,
  userId: 'user-1',
  params: {},
  userCanWrite: true,
  userCanDelete: true,
  locations: [
    { id: 'loc-1', name: 'ห้องทำงานชั้น 3' },
    { id: 'loc-2', name: 'ห้องเก็บของส่วนกลาง' },
  ],
  categories: [
    { id: 'cat-1', name: 'อุปกรณ์ไอที' },
    { id: 'cat-2', name: 'เครื่องเขียนและวัสดุสำนักงาน' },
  ],
  units: [
    { id: 'unit-1', name: 'เครื่อง' },
    { id: 'unit-2', name: 'รีม' },
  ],
}

function renderComponent(props = defaultProps) {
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, props)
    )
  )
}

test('header selects retained records and filter or sort changes clear selection', () => {
  const view = renderComponent()
  fireEvent.click(screen.getByLabelText('เลือกทุกรายการที่โหลดอยู่'))
  assert.ok(screen.getByText('เลือกอยู่ 2 รายการ'))
  view.rerender(<ToastProvider><ItemsExplorerClient {...defaultProps} params={{ sort_by: 'item_name' }} /></ToastProvider>)
  assert.equal(screen.queryByText('แก้ไขหลายรายการ'), null)
  fireEvent.click(screen.getByLabelText(`เลือก ${mockItems[0].item_name}`))
  view.rerender(<ToastProvider><ItemsExplorerClient {...defaultProps} params={{ q: 'new filter' }} /></ToastProvider>)
  assert.equal(screen.queryByText('แก้ไขหลายรายการ'), null)
})

test('ItemsExplorerClient renders table rows with full width', () => {
  renderComponent()

  // Verify item rows are rendered in the table
  assert.ok(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'))
  assert.ok(screen.getByText('EQ-2026-001'))

  // Slide-over drawer should be closed initially
  assert.equal(screen.queryByRole('dialog'), null)
})

test('list and grid render bounded visible records and view toggles preserve the item anchor', () => {
  const items = Array.from({ length: 500 }, (_, i) => ({ ...mockItems[0], id: `virtual-${i}`, item_name: `Virtual ${i}` }))
  const { container } = renderComponent({ ...defaultProps, items, total: 500 })
  assert.ok(screen.getAllByRole('row').length < 30)
  const root = screen.getByTestId('items-scroll')
  fireEvent.scroll(root, { target: { scrollTop: 6400 } })
  assert.ok(screen.getByText('Virtual 100'))
  fireEvent.click(screen.getByTitle('Grid view'))
  assert.ok(container.querySelectorAll('[tabindex="0"]').length < 50)
  assert.ok(screen.getByText('Virtual 100'))
  fireEvent.click(screen.getByTitle('List view'))
  assert.ok(screen.getByText('Virtual 100'))
  assert.ok(screen.getAllByRole('row').length < 30)
})

test('return snapshot restores deep position and refreshes the same cursor', async () => {
  const originalFetch = global.fetch
  const items = Array.from({ length: 200 }, (_, i) => ({ ...mockItems[0], id: `saved-${i}`, item_name: `Saved ${i}` }))
  const store = new ItemBatchWindow({ items: items.slice(0, 25), total: 200, nextCursor: '25' }, async cursor => {
    const start = Number(cursor)
    return { items: items.slice(start, start + 25), total: null, nextCursor: start + 25 < 200 ? String(start + 25) : null }
  })
  for (let i = 1; i < 8; i++) await store.loadMore()
  saveItemWindow({ identity: JSON.stringify(['user-1', normalizeItemListSearchParams({})]), state: store.state, view: 'list', anchor: 150 })
  const cursors: string[] = []
  global.fetch = async input => {
    const cursor = new URL(String(input), 'http://localhost').searchParams.get('cursor') ?? '0'
    cursors.push(cursor)
    const start = Number(cursor)
    return Response.json({ items: items.slice(start, start + 25), total: null, nextCursor: start + 25 < 200 ? String(start + 25) : null })
  }
  try {
    const view = renderComponent()
    await waitFor(() => assert.ok(screen.getByText('Saved 150')))
    assert.equal(cursors[0], '150')
    assert.ok(screen.getByTestId('items-scroll').scrollTop > 9000)
    const previousCalls = cursors.length
    view.rerender(<ToastProvider><ItemsExplorerClient {...defaultProps} items={[...mockItems]} /></ToastProvider>)
    await waitFor(() => assert.ok(cursors.length > previousCalls))
    await waitFor(() => assert.ok(screen.getByText('Saved 150')))
    assert.ok(Number(cursors[previousCalls]) >= 125, 'same-query server refresh must not reset to the initial cursor')
    assert.ok(screen.getByTestId('items-scroll').scrollTop > 9000)
  } finally { global.fetch = originalFetch }
})

test('Type navigation preserves search filters and resets category and pagination', () => {
  renderComponent({ ...defaultProps, params: { q: 'Dell', type: 'asset', status: 'active', location_id: 'loc-1', category_id: 'cat-1', page: '3' } })
  const navigation = within(screen.getByRole('navigation', { name: 'ประเภทพัสดุ' }))
  assert.equal(navigation.getByRole('link', { name: 'ครุภัณฑ์' }).getAttribute('aria-current'), 'page')
  const destination = new URL(navigation.getByRole('link', { name: 'วัสดุ' }).getAttribute('href')!, 'http://localhost')
  assert.equal(destination.searchParams.get('type'), 'material')
  assert.equal(destination.searchParams.get('q'), 'Dell')
  assert.equal(destination.searchParams.get('status'), 'active')
  assert.equal(destination.searchParams.get('location_id'), 'loc-1')
  assert.equal(destination.searchParams.get('category_id'), null)
  assert.equal(destination.searchParams.get('page'), null)
})

test('Clicking an item row opens the Slide-Over Inspector Drawer with correct metadata', () => {
  renderComponent()

  // Click on the first item row in table
  const row = screen.getByText('โน้ตบุ๊ก Dell Latitude 5420')
  fireEvent.click(row)

  // Drawer should now be visible
  const drawer = screen.getByRole('dialog')
  assert.ok(drawer)
  assert.equal(drawer.getAttribute('aria-label'), 'รายละเอียดรายการ')

  // Verify details within drawer
  const drawerScope = within(drawer)
  assert.ok(drawerScope.getByText('รายละเอียดสิ่งของ'))
  assert.ok(drawerScope.getByText('EQ-2026-001'))
  assert.ok(drawerScope.getByText('นายสมชาย วิศวกรรม'))
  assert.ok(drawerScope.getByText('ห้องทำงานชั้น 3'))
  assert.ok(drawerScope.getByText('฿32,000'))
  assert.ok(drawerScope.getByText('สภาพดี เบิกใช้งานเมื่อมกราคม 2026'))

  // Verify quick action buttons exist in drawer
  assert.ok(drawerScope.getByRole('button', { name: 'พิมพ์ป้ายบาร์โค้ด' }))
  assert.ok(drawerScope.getByRole('button', { name: 'ดูหน้ารายละเอียดเต็ม' }))
  assert.ok(drawerScope.getByRole('button', { name: 'แก้ไขข้อมูล' }))
})

test('Clicking close button closes the Slide-Over Inspector Drawer', () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByRole('dialog'))

  // Click close button inside drawer
  const closeButton = screen.getByRole('button', { name: 'ปิดแถบรายละเอียด' })
  fireEvent.click(closeButton)

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Pressing Escape key closes the Slide-Over Inspector Drawer', () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByRole('dialog'))

  // Press Escape
  fireEvent.keyDown(window, { key: 'Escape' })

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Clicking backdrop closes the Slide-Over Inspector Drawer', () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByRole('dialog'))

  // Click backdrop
  const backdrop = screen.getByTestId('inspector-backdrop')
  fireEvent.click(backdrop)

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Clicking another item row switches the inspected item in the drawer', () => {
  renderComponent()

  // Open first item
  const firstRow = screen.getByText('โน้ตบุ๊ก Dell Latitude 5420')
  fireEvent.click(firstRow)

  let drawer = screen.getByRole('dialog')
  assert.ok(within(drawer).getByText('EQ-2026-001'))

  // Click second item row in table
  const secondRow = screen.getByText('กระดาษ Double A A4 80gsm')
  fireEvent.click(secondRow)

  // Drawer should now display second item metadata
  drawer = screen.getByRole('dialog')
  const drawerScope = within(drawer)
  assert.ok(drawerScope.getByText('50 รีม'))
  assert.ok(drawerScope.getByText('฿135'))
  assert.ok(drawerScope.getByText('ห้องเก็บของส่วนกลาง'))
})

test('Table Focus Mode toggles on button click, preserves selected rows, and closes via Escape or close button', () => {
  renderComponent()

  // 1. Select an item first
  const checkbox = screen.getByLabelText(`เลือก ${mockItems[0].item_name}`)
  fireEvent.click(checkbox)
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

  // 2. Open Focus Mode
  const focusBtn = screen.getByRole('button', { name: 'เปิดโหมดโฟกัสตาราง' })
  fireEvent.click(focusBtn)

  // Overlay / Focus container should be visible
  assert.ok(screen.getByTestId('table-focus-overlay'))
  const exitBtn = screen.getByRole('button', { name: 'ออกจากโหมดโฟกัส' })
  assert.ok(exitBtn)

  // Item selection must remain intact
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

  // 3. Close via Escape key
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(screen.queryByTestId('table-focus-overlay'), null)
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

  // 4. Open again and close via close button
  fireEvent.click(screen.getByRole('button', { name: 'เปิดโหมดโฟกัสตาราง' }))
  assert.ok(screen.getByTestId('table-focus-overlay'))
  fireEvent.click(screen.getByRole('button', { name: 'ออกจากโหมดโฟกัส' }))
  assert.equal(screen.queryByTestId('table-focus-overlay'), null)
})

