import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemsList } from '../../features/items/components/items-list-view'
import type { ItemListRow } from '../../features/items/types'

const mockLedgerItems: ItemListRow[] = [
  {
    id: 'item-ledger-1',
    item_name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก สำหรับงานประมวลผล',
    item_type: 'asset',
    quantity: 1,
    unit_price: 21800,
    unit: { id: 'u-1', name: 'เครื่อง' },
    asset_no: 'สนง.7 7440-002-0005-2/2564',
    serial_no: 'NXVPNST01C1210D4027600',
    gfmis_number: '110000069558',
    budget_source: 'เงินบำรุง สสจ.ขก.',
    acquired_date: '2021-07-22',
    brand: 'Acer',
    model: 'TravelMate TMP214',
    responsible_person: 'กลุ่มงานสุขภาพดิจิทัล',
    location: { id: 'loc-1', name: 'ห้องประชุม EOC (ชั้น 4)' },
    status: 'active',
    note: 'ส่วนกลาง',
    updated_at: '2026-02-01T00:00:00Z',
    category: { id: 'c-1', name: 'ครุภัณฑ์คอมพิวเตอร์' },
  },
  {
    id: 'item-ledger-2',
    item_name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก Lenovo ThinkPad',
    item_type: 'asset',
    quantity: 1,
    unit_price: 22000,
    unit: { id: 'u-2', name: 'ชุด' },
    asset_no: 'สนง.7 7440-002-0005-1/2565',
    serial_no: 'PF68CKPX',
    gfmis_number: '110000105470',
    budget_source: 'เงินกู้ (ไวรัสโคโรนา 2019)',
    acquired_date: '2021-11-19',
    brand: 'Lenovo',
    model: 'ThinkPad L13 Gen2',
    responsible_person: 'กลุ่มงานสุขภาพดิจิทัล',
    location: { id: 'loc-2', name: 'ห้องประชุม EOC (ชั้น 4)' },
    status: 'damaged',
    note: 'จอแตก',
    updated_at: '2026-02-01T00:00:00Z',
    category: { id: 'c-1', name: 'ครุภัณฑ์คอมพิวเตอร์' },
  },
]

test('ItemsList: mode="ledger" renders official government header and 13 columns with 2-tier status header', () => {
  render(
    <ItemsList
      items={mockLedgerItems}
      mode="ledger"
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      onToggleSelectAll={() => {}}
      allLoadedSelected={false}
      params={{}}
      onToggleSort={() => {}}
    />
  )

  // Header Banner
  assert.ok(screen.getByText('ทะเบียนคุมสินทรัพย์'))
  assert.ok(screen.getByText('บัญชีแสดงรายการพัสดุคงเหลือ (ครุภัณฑ์ตามเกณฑ์)'))
  assert.ok(screen.getByText(/สำนักงานเขตสุขภาพที่ 7/))

  // Column Headers
  assert.ok(screen.getByText('ลำดับ'))
  assert.ok(screen.getByText('วัน เดือน ปีที่รับ'))
  assert.ok(screen.getByText('รับจาก (งปม.)'))
  assert.ok(screen.getByText('รายการครุภัณฑ์'))
  assert.ok(screen.getByText('ยี่ห้อ/รุ่น'))
  assert.ok(screen.getByText('ราคา'))
  assert.ok(screen.getByText('หน่วย'))
  assert.ok(screen.getByText('เลขครุภัณฑ์'))
  assert.ok(screen.getByText('เลขสินทรัพย์'))
  assert.ok(screen.getByText('ผู้ครอบครอง'))
  assert.ok(screen.getByText('ใช้งานที่'))
  assert.ok(screen.getByText('สภาพพัสดุ'))
  assert.ok(screen.getByText('ใช้งานได้'))
  assert.ok(screen.getByText('ชำรุด'))
  assert.ok(screen.getByText('เสื่อมสภาพ'))
  assert.ok(screen.getByText('หมายเหตุ'))

  // Data row 1 content
  assert.ok(screen.getByText('22-ก.ค.-64'))
  assert.ok(screen.getByText('เงินบำรุง สสจ.ขก.'))
  assert.ok(screen.getByText('เครื่องคอมพิวเตอร์โน้ตบุ๊ก สำหรับงานประมวลผล'))
  assert.ok(screen.getByText('21,800.00'))
  assert.ok(screen.getByText('สนง.7 7440-002-0005-2/2564'))
  assert.ok(screen.getByText('110000069558'))
  assert.ok(screen.getAllByText('กลุ่มงานสุขภาพดิจิทัล').length >= 1)
  assert.ok(screen.getAllByText('ห้องประชุม EOC (ชั้น 4)').length >= 1)

  // Data row 2 content
  assert.ok(screen.getByText('19-พ.ย.-64'))
  assert.ok(screen.getByText('เงินกู้ (ไวรัสโคโรนา 2019)'))
  assert.ok(screen.getByText('110000105470'))
})

test('ItemsList: mode="ledger" interactive checkmarks invoke onUpdateStatus when clicked by authorized writer', () => {
  let updatedItemId = ''
  let updatedStatus = ''

  render(
    <ItemsList
      items={mockLedgerItems}
      mode="ledger"
      userCanWrite={true}
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      onToggleSelectAll={() => {}}
      allLoadedSelected={false}
      params={{}}
      onToggleSort={() => {}}
      onUpdateStatus={(id, status) => {
        updatedItemId = id
        updatedStatus = status
      }}
    />
  )

  // Item 1 has status 'active' -> click its 'ชำรุด' button
  const damagedBtn = screen.getByLabelText('เครื่องคอมพิวเตอร์โน้ตบุ๊ก สำหรับงานประมวลผล สภาพชำรุด')
  fireEvent.click(damagedBtn)

  assert.equal(updatedItemId, 'item-ledger-1')
  assert.equal(updatedStatus, 'damaged')
})
