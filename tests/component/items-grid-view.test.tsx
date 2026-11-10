import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemsGrid } from '../../features/items/components/items-grid-view'
import type { ItemListRow } from '../../features/items/types'

const mockItem: ItemListRow = {
  id: 'item-1',
  item_name: 'โน้ตบุ๊ก Dell Latitude 5420',
  item_type: 'asset',
  quantity: 1,
  unit_price: 32000,
  asset_no: 'EQ-2026-001',
  serial_no: 'SN-DELL-998',
  responsible_person: 'เจ้าหน้าที่พัสดุ',
  status: 'active',
  updated_at: '2026-03-01T00:00:00Z',
  category: { id: 'cat-1', name: 'อุปกรณ์ไอที' },
  unit: { id: 'unit-1', name: 'เครื่อง' },
  location: { id: 'loc-1', name: 'ห้องทำงานชั้น 3' },
  brand: 'Dell',
  model: 'Latitude 5420',
  note: null,
  image_url: null,
}

test('ItemsGrid: Quick Actions work and respect userCanWrite permissions', () => {
  let printedItem: ItemListRow | null = null
  let copiedValue: string | null = null

  // 1. Viewer mode (userCanWrite=false)
  const { unmount } = render(
    <ItemsGrid
      items={[mockItem]}
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      userCanWrite={false}
      onCopy={(val) => { copiedValue = val ?? null }}
      onPrint={(item) => { printedItem = item }}
    />
  )

  const copyBtn = screen.getByLabelText(`คัดลอก ${mockItem.asset_no}`)
  assert.ok(copyBtn)
  fireEvent.click(copyBtn)
  assert.equal(copiedValue, mockItem.asset_no)

  // Edit and Print buttons MUST NOT exist for viewer
  assert.equal(screen.queryByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItem.item_name}`), null)
  assert.equal(screen.queryByLabelText(`แก้ไขข้อมูล ${mockItem.item_name}`), null)
  unmount()

  // 2. Staff/Admin mode (userCanWrite=true)
  render(
    <ItemsGrid
      items={[mockItem]}
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      userCanWrite={true}
      onCopy={(val) => { copiedValue = val ?? null }}
      onPrint={(item) => { printedItem = item }}
    />
  )

  const printBtn = screen.getByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItem.item_name}`)
  assert.ok(printBtn)
  fireEvent.click(printBtn)
  assert.equal((printedItem as ItemListRow | null)?.id, mockItem.id)
})
