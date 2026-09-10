import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, render, screen, fireEvent, within } from '@testing-library/react'

// This component test exercises the inspector UI, not the live Supabase channel.
// Disable the channel so placeholder CI credentials cannot leave a realtime socket open.
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { Inspector } from '../../app/(dashboard)/items/items-inspector'
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
  page: 1,
  totalPages: 1,
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

test('Inspector forwards the selected item to print and edit actions', () => {
  const item = mockItems[0]
  const printed: unknown[] = []
  const edited: ItemListRow[] = []
  render(React.createElement(Inspector, {
    isOpen: true,
    onClose: () => {},
    item,
    userCanWrite: true,
    userCanDelete: false,
    onCopy: () => {},
    onPrint: (value) => printed.push(value),
    onEdit: (value) => edited.push(value),
  }))

  fireEvent.click(screen.getByRole('button', { name: 'พิมพ์สติกเกอร์' }))
  assert.deepEqual(printed, [{
    id: item.id,
    item_name: item.item_name,
    asset_no: item.asset_no,
    serial_no: item.serial_no,
    brand: item.brand,
    model: item.model,
    location_name: item.location?.name,
    category_name: item.category?.name,
    responsible_person: item.responsible_person,
    unit_price: item.unit_price,
  }])
  fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูล' }))
  assert.deepEqual(edited, [item])
})

test('Escape dismisses the inspector while its first dynamic import is pending', async () => {
  renderComponent()
  fireEvent.click(screen.getByText(mockItems[0].item_name))
  assert.equal(screen.getByText('กำลังโหลดรายละเอียด…').getAttribute('role'), 'status')
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(screen.queryByText('กำลังโหลดรายละเอียด…'), null)
  await act(async () => {
    await import('../../app/(dashboard)/items/items-inspector')
  })
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Inspector groups complete depreciation details and preserves zero prices', async () => {
  renderComponent({ ...defaultProps, items: [{ ...mockItems[0],
    unit_price: 0,
    created_at: '2026-01-01T01:00:00Z',
    depreciation_enabled: true,
    depreciation_cost: 10001,
    depreciation_useful_life_years: 5,
    depreciation_start_basis: 'available',
    depreciation_start_date: '2026-01-01',
    depreciation_residual_value: 1,
  }] })
  fireEvent.click(screen.getByText(mockItems[0].item_name))
  const drawer = within(await screen.findByRole('dialog'))
  assert.ok(drawer.getByRole('region', { name: 'ข้อมูลหลัก' }))
  const price = within(drawer.getByRole('region', { name: 'ทะเบียนและราคา' }))
  assert.ok(price.getByText('฿0'))
  assert.ok(price.getByText('0.00 บาท'))
  const depreciation = within(drawer.getByRole('region', { name: 'การคิดค่าเสื่อมราคา' }))
  assert.ok(depreciation.getByText('2,000.00 บาท'))
  assert.ok(depreciation.getByText('วันที่พร้อมใช้งาน'))
  assert.ok(depreciation.getByText(/สูตร: ค่าเสื่อมต่อปี/))
  assert.ok(drawer.getByRole('region', { name: 'ข้อมูลการบันทึก' }))
  assert.ok(drawer.getByText('1 ม.ค. 2569 08:00'))
})

test('ItemsExplorerClient renders table rows with full width', async () => {
  renderComponent()

  // Verify item rows are rendered in the table
  assert.ok(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'))
  assert.ok(screen.getByText('EQ-2026-001'))

  // Slide-over drawer should be closed initially
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Clicking an item row opens the Slide-Over Inspector Drawer with correct metadata', async () => {
  renderComponent()

  // Click on the first item row in table
  const row = screen.getByText('โน้ตบุ๊ก Dell Latitude 5420')
  fireEvent.click(row)

  // Drawer should now be visible
  const drawer = await screen.findByRole('dialog')
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
  assert.ok(drawerScope.getByRole('button', { name: 'พิมพ์สติกเกอร์' }))
  assert.ok(drawerScope.getByRole('button', { name: 'ดูหน้ารายละเอียดเต็ม' }))
  assert.ok(drawerScope.getByRole('button', { name: 'แก้ไขข้อมูล' }))
})

test('Clicking close button closes the Slide-Over Inspector Drawer', async () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(await screen.findByRole('dialog'))

  // Click close button inside drawer
  const closeButton = screen.getByRole('button', { name: 'ปิดแถบรายละเอียด' })
  fireEvent.click(closeButton)

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Pressing Escape key closes the Slide-Over Inspector Drawer', async () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(await screen.findByRole('dialog'))

  // Press Escape
  fireEvent.keyDown(window, { key: 'Escape' })

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Clicking backdrop closes the Slide-Over Inspector Drawer', async () => {
  renderComponent()

  // Open drawer
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(await screen.findByRole('dialog'))

  // Click backdrop
  const backdrop = screen.getByTestId('inspector-backdrop')
  fireEvent.click(backdrop)

  // Drawer should be closed
  assert.equal(screen.queryByRole('dialog'), null)
})

test('Clicking another item row switches the inspected item in the drawer', async () => {
  renderComponent()

  // Open first item
  const firstRow = screen.getByText('โน้ตบุ๊ก Dell Latitude 5420')
  fireEvent.click(firstRow)

  let drawer = await screen.findByRole('dialog')
  assert.ok(within(drawer).getByText('EQ-2026-001'))

  // Click second item row in table
  const secondRow = screen.getByText('กระดาษ Double A A4 80gsm')
  fireEvent.click(secondRow)

  // Drawer should now display second item metadata
  drawer = await screen.findByRole('dialog')
  const drawerScope = within(drawer)
  assert.ok(drawerScope.getByText('50 รีม'))
  assert.ok(drawerScope.getByText('฿135'))
  assert.ok(drawerScope.getByText('ห้องเก็บของส่วนกลาง'))
})
