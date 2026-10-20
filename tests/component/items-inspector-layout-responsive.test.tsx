import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'

// This component test exercises UI layout without live Supabase realtime channels
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { Inspector } from '../../features/items/components/item-inspector-drawer'
import { ItemsList } from '../../features/items/components/items-list-view'
import { ItemsFilterBar } from '../../features/items/components/items-filter-bar'
import { ToastProvider } from '../../components/ui/toast'
import type { ItemListRow } from '../../features/items/types'

const mockItem: ItemListRow = {
  id: 'item-101',
  item_name: 'คอมพิวเตอร์พกพา Lenovo ThinkPad T14 Gen 3 พร้อมอุปกรณ์ต่อพ่วงครบชุด',
  item_type: 'asset',
  category: { id: 'cat-1', name: 'อุปกรณ์คอมพิวเตอร์และสื่อสาร' },
  location: { id: 'loc-1', name: 'ห้องประชุมสารสนเทศ ชั้น 4 อาคารอำนวยการ' },
  unit: { id: 'unit-1', name: 'เครื่อง' },
  quantity: 5,
  unit_price: 45000,
  asset_no: 'ASSET-2026-990011',
  serial_no: 'SN-LNV-887766554433',
  brand: 'Lenovo',
  model: 'ThinkPad T14',
  responsible_person: 'ดร.สมเกียรติ พัฒนกิจเจริญสุข',
  status: 'active',
  note: 'มีประกันศูนย์ 3 ปี',
  image_url: null,
  updated_at: '2026-03-01T00:00:00Z',
}

test('Responsive Layout: Docked Inspector has responsive width classes and no backdrop', () => {
  render(
    <Inspector
      isOpen={true}
      mode="docked"
      item={mockItem}
      onClose={() => {}}
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

  // Width classes must adapt across screen sizes and cap at 45%
  assert.ok(panel.classList.contains('w-[340px]'), 'should use 340px base width on laptop/desktop')
  assert.ok(panel.classList.contains('xl:w-[380px]'), 'should scale to 380px on xl (1366px)')
  assert.ok(panel.classList.contains('2xl:w-[420px]'), 'should scale to 420px on 2xl (1680px)')
  assert.ok(panel.classList.contains('max-w-[45%]'), 'should cap at 45% of viewport')

  // In docked mode, backdrop must NEVER be rendered
  assert.equal(screen.queryByTestId('inspector-backdrop'), null)

  // Verify internal elements prevent text squishing with min-w-0 / truncate
  const titles = screen.getAllByText(mockItem.item_name)
  assert.ok(titles[0].classList.contains('truncate'))

  const assetNo = screen.getByText('ASSET-2026-990011')
  assert.ok(assetNo.classList.contains('truncate'))
  assert.ok(assetNo.classList.contains('min-w-0'))
})

test('Responsive Layout: Drawer Inspector mode preserves mobile slide-over with backdrop', () => {
  let closed = false
  render(
    <Inspector
      isOpen={true}
      mode="drawer"
      item={mockItem}
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
  assert.ok(panel.classList.contains('fixed'))
  assert.ok(panel.classList.contains('z-50'))

  const backdrop = screen.getByTestId('inspector-backdrop')
  assert.ok(backdrop)
  fireEvent.click(backdrop)
  assert.equal(closed, true)
})

test('Responsive Layout: ItemsList collapses secondary columns and adjusts min-w when Inspector opens', () => {
  // Test with Inspector OPEN
  const { container: openContainer } = render(
    <ItemsList
      items={[mockItem]}
      topSpace={0}
      bottomSpace={0}
      allLoadedSelected={false}
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      onToggleSelectAll={() => {}}
      params={{}}
      onToggleSort={() => {}}
      isInspectorOpen={true}
    />
  )

  const openTable = openContainer.querySelector('table')
  assert.ok(openTable)
  // Contracted adaptive min-width
  assert.ok(openTable.classList.contains('min-w-[420px]'))
  assert.ok(openTable.classList.contains('xl:min-w-[640px]'))
  assert.ok(openTable.classList.contains('2xl:min-w-[840px]'))

  // Check column visibility when inspector is open:
  // Location and Type must be hidden below xl (e.g. at 1024px laptop)
  const openHeads = openContainer.querySelectorAll('th')
  // Head 3: Type -> hidden xl:table-cell
  assert.ok(openHeads[3].classList.contains('hidden'))
  assert.ok(openHeads[3].classList.contains('xl:table-cell'))
  assert.equal(openHeads[3].classList.contains('sm:table-cell'), false)

  // Head 4: Category -> hidden 2xl:table-cell
  assert.ok(openHeads[4].classList.contains('hidden'))
  assert.ok(openHeads[4].classList.contains('2xl:table-cell'))

  // Head 6: Location -> hidden xl:table-cell
  assert.ok(openHeads[6].classList.contains('hidden'))
  assert.ok(openHeads[6].classList.contains('xl:table-cell'))

  // Head 7: Responsible Person -> hidden 2xl:table-cell
  assert.ok(openHeads[7].classList.contains('hidden'))
  assert.ok(openHeads[7].classList.contains('2xl:table-cell'))

  // Test with Inspector CLOSED
  const { container: closedContainer } = render(
    <ItemsList
      items={[mockItem]}
      topSpace={0}
      bottomSpace={0}
      allLoadedSelected={false}
      selectedItemId={null}
      selectedItemIds={[]}
      onSelect={() => {}}
      onToggleSelectItem={() => {}}
      onToggleSelectAll={() => {}}
      params={{}}
      onToggleSort={() => {}}
      isInspectorOpen={false}
    />
  )

  const closedTable = closedContainer.querySelector('table')
  assert.ok(closedTable)
  assert.ok(closedTable.classList.contains('min-w-[480px]'))

  const closedHeads = closedContainer.querySelectorAll('th')
  // Head 3: Type -> hidden sm:table-cell
  assert.ok(closedHeads[3].classList.contains('sm:table-cell'))
  // Head 6: Location -> hidden sm:table-cell
  assert.ok(closedHeads[6].classList.contains('sm:table-cell'))
})

test('Responsive Layout: ItemsFilterBar wraps search, selects, and export button cleanly', () => {
  const { container } = render(
    <ItemsFilterBar
      searchVal=""
      onSearchChange={() => {}}
      onSearchClear={() => {}}
      params={{}}
      categories={[{ id: 'cat-1', name: 'อุปกรณ์ไอที' }]}
      locations={[{ id: 'loc-1', name: 'ห้องทำงานชั้น 3' }]}
      onFilterChange={() => {}}
      onResetFilters={() => {}}
      folderValuation={45000}
      localItemsCount={1}
      isExporting={false}
      onExport={() => {}}
      userCanWrite={true}
    />
  )

  const filterBar = container.querySelector('[data-testid="items-filter-bar"]')
  assert.ok(filterBar)
  assert.ok(filterBar.classList.contains('min-w-0'))

  // Controls row has responsive flex wrap without forcing sm:flex-row overlap
  const controlsRow = filterBar.firstElementChild
  assert.ok(controlsRow?.classList.contains('min-w-0'))
  assert.ok(controlsRow?.classList.contains('flex-col'))
  assert.ok(controlsRow?.classList.contains('lg:flex-row'))

  // Search input wrapper uses adaptive flex-1 and min/max width
  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...')
  const searchWrapper = searchInput.closest('div')?.parentElement
  assert.ok(searchWrapper?.classList.contains('min-w-0'))
  assert.ok(searchWrapper?.classList.contains('w-full'))
  assert.ok(searchWrapper?.classList.contains('sm:min-w-[200px]'))

  // Select dropdowns have max-w truncate to avoid ballooning
  const categorySelect = screen.getByLabelText('กรองตามหมวดหมู่')
  assert.ok(categorySelect.classList.contains('max-w-[160px]'))
  assert.ok(categorySelect.classList.contains('truncate'))

  // Export button has shrink-0 to prevent being squeezed
  const exportBtn = screen.getByRole('button', { name: /ดาวน์โหลด Excel/ })
  assert.ok(exportBtn.classList.contains('shrink-0'))
})

test('Responsive Layout: ItemsExplorerClient main area allows flex shrinking without w-full conflict', () => {
  const { container } = render(
    <ToastProvider>
      <ItemsExplorerClient
        items={[mockItem]}
        total={1}
        nextCursor={null}
        userId="user-test"
        params={{}}
        userCanWrite={true}
        userCanDelete={true}
        locations={[]}
        categories={[]}
        units={[]}
      />
    </ToastProvider>
  )

  const main = container.querySelector('main')
  assert.ok(main)
  assert.ok(main.classList.contains('min-w-0'), 'main content must have min-w-0 for flex children')
  assert.equal(main.classList.contains('w-full'), false, 'main must NOT set w-full when sharing flex row with inspector')

  const scrollContainer = container.querySelector('[data-testid="items-scroll"]')
  assert.ok(scrollContainer)
  assert.ok(scrollContainer.classList.contains('min-w-0'))
  assert.ok(scrollContainer.classList.contains('overflow-auto'))
})
