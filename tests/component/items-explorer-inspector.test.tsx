import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'

// This component test exercises the inspector UI, not the live Supabase channel.
// Disable the channel so placeholder CI credentials cannot leave a realtime socket open.
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { Inspector } from '../../features/items/components/item-inspector-drawer'
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
  pageSize: 50,
  totalPages: 1,
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

test('list and grid render 50 items and view toggles preserve inspected item without virtual scrolling', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ ...mockItems[0], id: `item-page-${i}`, item_name: `Page Item ${i}` }))
  const { container } = renderComponent({ ...defaultProps, items, total: 237, page: 1, pageSize: 50, totalPages: 5 })
  // In list view, all 50 items are rendered directly without virtual spacer rows
  const rows = screen.getAllByRole('row')
  // 1 header row + 50 data rows = 51 rows
  assert.equal(rows.length, 51)
  assert.equal(container.querySelector('[key="__virtual-top-spacer__"]'), null)
  assert.equal(container.querySelector('[key="__virtual-bottom-spacer__"]'), null)

  // Click on item 10 to inspect it
  fireEvent.click(screen.getByText('Page Item 10'))
  assert.ok(screen.getAllByText('Page Item 10').length >= 1)

  // Toggle to Grid view
  fireEvent.click(screen.getByTitle('Grid view'))
  assert.equal(container.querySelectorAll('.grid > div[tabindex="0"]').length, 50)
  assert.ok(screen.getAllByText('Page Item 10').length >= 1)

  // Toggle back to List view
  fireEvent.click(screen.getByTitle('List view'))
  assert.equal(screen.getAllByRole('row').length, 51)
})

test('pagination footer displays range, total, single valuation metric, and handles page buttons', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ ...mockItems[0], id: `page1-${i}`, item_name: `Page 1 Item ${i}` }))
  renderComponent({ ...defaultProps, items, total: 237, page: 1, pageSize: 50, totalPages: 5 })

  // Summary badge: "แสดง 1–50 จาก 237 รายการ"
  assert.ok(screen.getByText('แสดง 1–50 จาก 237 รายการ'))

  // Single valuation metric in bottom summary footer: 50 * 32,000 = 1,600,000
  const valuationSummary = screen.getByTestId('page-valuation-summary')
  assert.ok(valuationSummary)
  assert.ok(valuationSummary.textContent?.includes('มูลค่ารวมในหน้านี้:'))
  assert.ok(valuationSummary.textContent?.includes('฿1,600,000'))

  // Verify no duplicate valuation element with old or redundant label
  assert.equal(screen.queryByText('มูลค่ารายการที่โหลดอยู่:'), null)

  // Previous button should be disabled on page 1
  const prevBtn = screen.getByRole('button', { name: 'หน้าก่อนหน้า' })
  assert.equal((prevBtn as HTMLButtonElement).disabled, true)

  // Next button should be enabled
  const nextBtn = screen.getByRole('button', { name: 'หน้าถัดไป' })
  assert.equal((nextBtn as HTMLButtonElement).disabled, false)

  // Current page 1 should have aria-current="page"
  const page1Btn = screen.getByRole('button', { name: 'หน้า 1' })
  assert.equal(page1Btn.getAttribute('aria-current'), 'page')
})

test('pagination footer displays zero count and zero valuation when empty', () => {
  renderComponent({ ...defaultProps, items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 })

  assert.ok(screen.getByText('แสดง 0 จาก 0 รายการ'))
  const valuationSummary = screen.getByTestId('page-valuation-summary')
  assert.ok(valuationSummary)
  assert.ok(valuationSummary.textContent?.includes('มูลค่ารวมในหน้านี้:'))
  assert.ok(valuationSummary.textContent?.includes('฿0'))
})

test('Type navigation preserves search filters and resets category and pagination', () => {
  renderComponent({ ...defaultProps, params: { q: 'Dell', type: 'asset', status: 'active', location_id: 'loc-1', category_id: 'cat-1', page: '3' } })
  const navigation = within(screen.getByRole('navigation', { name: 'ประเภทพัสดุ' }))
  assert.equal(navigation.getByRole('link', { name: 'ครุภัณฑ์' }).getAttribute('aria-current'), 'page')
  const destination = new URL(navigation.getByRole('link', { name: 'พัสดุ' }).getAttribute('href')!, 'http://localhost')
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

test('Inspector: mode="docked" renders right-side split pane without modal backdrop', () => {
  let closed = false

  render(
    <Inspector
      isOpen={true}
      mode="docked"
      item={mockItems[0]}
      onClose={() => { closed = true }}
      onOpenDetails={() => {}}
      userCanWrite={true}
      userCanDelete={true}
      onCopy={() => {}}
      onPrint={() => {}}
      onEdit={() => {}}
    />
  )

  const panel = screen.getByTestId('inspector-panel')
  assert.ok(panel)
  assert.equal(panel.getAttribute('data-mode'), 'docked')
  assert.equal(panel.getAttribute('role'), 'region')
  assert.ok(panel.classList.contains('border-l'))
  assert.ok(panel.classList.contains('w-[340px]'), 'should have 340px base width on desktop/laptop')
  assert.ok(panel.classList.contains('xl:w-[380px]'), 'should scale to 380px on xl')
  assert.ok(panel.classList.contains('2xl:w-[420px]'), 'should scale to 420px on 2xl')
  assert.ok(panel.classList.contains('max-w-[45%]'), 'should cap width at 45% of viewport')

  // NO backdrop should exist in docked mode to allow unrestricted interaction with table
  assert.equal(screen.queryByTestId('inspector-backdrop'), null)

  // Close button works
  const closeBtn = screen.getByLabelText('ปิดแถบรายละเอียด')
  fireEvent.click(closeBtn)
  assert.equal(closed, true)
})

test('Inspector: mode="drawer" renders slide-over sheet with backdrop and aria-modal', () => {
  let closed = false

  render(
    <Inspector
      isOpen={true}
      mode="drawer"
      item={mockItems[0]}
      onClose={() => { closed = true }}
      onOpenDetails={() => {}}
      userCanWrite={true}
      userCanDelete={true}
      onCopy={() => {}}
      onPrint={() => {}}
      onEdit={() => {}}
    />
  )

  const panel = screen.getByTestId('inspector-panel')
  assert.ok(panel)
  assert.equal(panel.getAttribute('data-mode'), 'drawer')
  assert.equal(panel.getAttribute('role'), 'dialog')
  assert.equal(panel.getAttribute('aria-modal'), 'true')

  // Backdrop must be present in drawer mode
  const backdrop = screen.getByTestId('inspector-backdrop')
  assert.ok(backdrop)
  fireEvent.click(backdrop)
  assert.equal(closed, true)
})

test('ItemsExplorerClient: table contracts width class when inspector is opened', () => {
  const { container } = renderComponent()

  // Main area should have min-w-0 and NOT force w-full next to flex inspector
  const main = container.querySelector('main')
  assert.ok(main?.classList.contains('min-w-0'))
  assert.equal(main?.classList.contains('w-full'), false)

  // Before opening inspector: uses adaptive min-w without inspector
  let table = container.querySelector('table')
  assert.ok(table?.classList.contains('min-w-[480px]'))

  // Click row to open inspector
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))

  // Table contracts to smaller min-w (min-w-[420px]) to allow side-by-side room without overflow
  table = container.querySelector('table')
  assert.ok(table?.classList.contains('min-w-[420px]'))
})

test('Keyboard Navigation: ArrowDown and ArrowUp navigate through items and synchronize inspector', () => {
  renderComponent()

  // Initially no inspector is open
  assert.equal(screen.queryByTestId('inspector-panel'), null)

  // Press ArrowDown -> selects first item (item-1: Dell Latitude)
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  let inspector = screen.getByTestId('inspector-panel')
  assert.ok(inspector)
  assert.ok(within(inspector).getByText('EQ-2026-001'))

  // Press ArrowDown again -> moves to second item (item-2: Double A)
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  inspector = screen.getByTestId('inspector-panel')
  assert.ok(within(inspector).getByText('50 รีม'))

  // Press ArrowDown at end of list -> clamps to last item
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  inspector = screen.getByTestId('inspector-panel')
  assert.ok(within(inspector).getByText('50 รีม'))

  // Press ArrowUp -> moves back to first item (item-1: Dell Latitude)
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  inspector = screen.getByTestId('inspector-panel')
  assert.ok(within(inspector).getByText('EQ-2026-001'))

  // Press ArrowUp at index 0 -> clamps to index 0
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  inspector = screen.getByTestId('inspector-panel')
  assert.ok(within(inspector).getByText('EQ-2026-001'))
})

test('Keyboard Navigation: Space key toggles selection of currently active item', () => {
  renderComponent()

  // Navigate to first item
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  assert.equal(screen.queryByText(/เลือกอยู่ 1 รายการ/), null)

  // Press Space -> toggles checkbox for item-1
  fireEvent.keyDown(window, { key: ' ' })
  assert.ok(screen.getByText(/เลือกอยู่ 1 รายการ/))

  // Press Space again -> untoggles selection
  fireEvent.keyDown(window, { key: ' ' })
  assert.equal(screen.queryByText(/เลือกอยู่ 1 รายการ/), null)
})

test('Keyboard Navigation: / key focuses search input', () => {
  renderComponent()

  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...')
  assert.notEqual(document.activeElement, searchInput)

  // Press "/" globally
  fireEvent.keyDown(window, { key: '/' })
  assert.equal(document.activeElement, searchInput)
})

test('Keyboard Focus Guard: suppresses shortcuts when user is typing inside an input', () => {
  renderComponent()

  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...')
  searchInput.focus()
  assert.equal(document.activeElement, searchInput)

  // Press ArrowDown while search input is focused -> should NOT open inspector or navigate
  fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
  assert.equal(screen.queryByTestId('inspector-panel'), null)

  // Press Space while search input is focused -> should NOT toggle item selection
  fireEvent.keyDown(searchInput, { key: ' ' })
  assert.equal(screen.queryByText(/เลือกอยู่/), null)
})

test('Filter Change Behavior: clears inspectedItem when item is no longer in filtered dataset', () => {
  const view = renderComponent()

  // Select item-1
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  assert.ok(screen.getByTestId('inspector-panel'))

  // Re-render with items that do NOT contain item-1 (e.g. filtered by material)
  view.rerender(
    <ToastProvider>
      <ItemsExplorerClient
        {...defaultProps}
        items={[mockItems[1]]}
        total={1}
        params={{ type: 'material' }}
      />
    </ToastProvider>
  )

  // Inspected item must be cleared and panel closed
  assert.equal(screen.queryByTestId('inspector-panel'), null)
})

test('List View: does not render print quick action in table row; printing is accessible via Inspector', () => {
  renderComponent()

  // Table row should not have print quick action
  assert.equal(screen.queryByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItems[0].item_name}`), null)

  // Click row to open Inspector
  fireEvent.click(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'))
  const inspector = screen.getByTestId('inspector-panel')
  assert.ok(inspector)

  // Print button is available in Inspector
  const printButton = within(inspector).getByRole('button', { name: 'พิมพ์ป้ายบาร์โค้ด' })
  fireEvent.click(printButton)

  // Print modal dialog should be open
  const printTitle = screen.getByText(/พิมพ์ลาเบลติดครุภัณฑ์/)
  assert.ok(printTitle)
  const dialog = printTitle.closest('div[role="dialog"]')
  assert.ok(dialog)
  assert.ok(within(dialog as HTMLElement).getAllByText('EQ-2026-001').length > 0)
})

test('Quick Actions in Grid View: Print and Copy buttons work and RBAC Viewer hides Edit and Print', () => {
  // Render with userCanWrite=false (Viewer role)
  const { unmount } = renderComponent({ ...defaultProps, userCanWrite: false })

  // Switch to Grid View
  fireEvent.click(screen.getByTitle('Grid view'))

  // Copy button should exist on card
  const copyBtn = screen.getByLabelText(`คัดลอก ${mockItems[0].asset_no}`)
  assert.ok(copyBtn)

  // Edit and Print buttons MUST NOT exist for viewer (guarded by userCanWrite)
  assert.equal(screen.queryByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItems[0].item_name}`), null)
  assert.equal(screen.queryByLabelText(`แก้ไขข้อมูล ${mockItems[0].item_name}`), null)
  unmount()

  // Render with userCanWrite=true (Staff/Admin) to verify Print action
  renderComponent({ ...defaultProps, userCanWrite: true })
  fireEvent.click(screen.getByTitle('Grid view'))

  const printBtn = screen.getByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItems[0].item_name}`)
  assert.ok(printBtn)

  // Clicking print button opens sticker modal without opening inspector drawer
  fireEvent.click(printBtn)
  assert.ok(screen.getByText(/พิมพ์ลาเบลติดครุภัณฑ์/))
  assert.equal(screen.queryByTestId('inspector-panel'), null)
})

test('Table Focus Mode: toggle button toggles focused workspace and preserves state', () => {
  renderComponent()

  // 1. Initially focus mode is off
  const toggleBtn = screen.getByRole('button', { name: /ขยายเต็มหน้าจอ|โฟกัสตาราง|Focus Mode/i })
  assert.ok(toggleBtn)
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false')

  // Select an item first to verify state preservation
  fireEvent.click(screen.getByLabelText(`เลือก ${mockItems[0].item_name}`))
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

  // 2. Click toggle button to enter focus mode
  fireEvent.click(toggleBtn)
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true')
  assert.ok(screen.getByTestId('focus-mode-backdrop'))
  assert.ok(screen.getByTestId('focus-mode-container'))

  // State is preserved!
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

  // 3. Escape key dismisses focus mode
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false')
  assert.equal(screen.queryByTestId('focus-mode-backdrop'), null)

  // 4. Close button inside focus mode header also dismisses
  fireEvent.click(toggleBtn)
  assert.ok(screen.getByTestId('focus-mode-container'))
  const closeBtn = screen.getByRole('button', { name: /ปิดโหมดโฟกัส|ย่อหน้าจอ|ออกจากโหมดโฟกัส/i })
  fireEvent.click(closeBtn)
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false')
  assert.equal(screen.queryByTestId('focus-mode-container'), null)
})
