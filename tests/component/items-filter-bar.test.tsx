import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemsFilterBar, type ItemsFilterBarProps } from '../../features/items/components/items-filter-bar'
import type { ItemsFilterUpdates } from '../../features/items/hooks/use-items-filter'

const mockCategories = [
  { id: 'cat-1', name: 'อุปกรณ์ไอที' },
  { id: 'cat-2', name: 'เฟอร์นิเจอร์สำนักงาน' },
]

const mockLocations = [
  { id: 'loc-1', name: 'ห้องทำงานชั้น 3' },
  { id: 'loc-2', name: 'ห้องเก็บของส่วนกลาง' },
]

function renderFilterBar(overrides: Partial<ItemsFilterBarProps> = {}) {
  const defaultProps: ItemsFilterBarProps = {
    searchVal: '',
    onSearchChange: () => {},
    onSearchClear: () => {},
    onNavigateToItem: () => {},
    params: {},
    categories: mockCategories,
    locations: mockLocations,
    onFilterChange: () => {},
    onResetFilters: () => {},
    folderValuation: 245000,
    localItemsCount: 15,
    isExporting: false,
    onExport: () => {},
    ...overrides,
  }

  return render(<ItemsFilterBar {...defaultProps} />)
}

test('ItemsFilterBar: renders search input, dropdown filters, and export button without redundant valuation metric', () => {
  renderFilterBar({ folderValuation: 1500000 })

  // Search input
  assert.ok(screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...'))

  // Select dropdowns
  assert.ok(screen.getByLabelText('กรองตามหมวดหมู่'))
  assert.ok(screen.getByLabelText('กรองตามสถานะ'))
  assert.ok(screen.getByLabelText('กรองตามสถานที่'))

  // Valuation metric should NOT be rendered in the filter bar (moved to bottom summary footer)
  assert.equal(screen.queryByText('มูลค่ารายการที่โหลดอยู่:'), null)
  assert.equal(screen.queryByText('฿1,500,000'), null)

  // Download Excel button
  assert.ok(screen.getByRole('button', { name: /ดาวน์โหลด Excel/i }))

  // Without filters, active chips bar is hidden
  assert.equal(screen.queryByTestId('active-filter-chips'), null)
})

test('ItemsFilterBar: renders active filter chips when filters are applied in params', () => {
  renderFilterBar({
    params: {
      category_id: 'cat-1',
      status: 'active',
      location_id: 'loc-2',
      q: 'MacBook',
    },
  })

  const chipsBar = screen.getByTestId('active-filter-chips')
  assert.ok(chipsBar)

  // Verify human-readable names scoped within each chip
  const catChip = screen.getByTestId('active-chip-category')
  assert.ok(catChip.textContent?.includes('อุปกรณ์ไอที'))

  const statusChip = screen.getByTestId('active-chip-status')
  assert.ok(statusChip.textContent?.includes('ใช้งานอยู่'))

  const locChip = screen.getByTestId('active-chip-location')
  assert.ok(locChip.textContent?.includes('ห้องเก็บของส่วนกลาง'))

  const qChip = screen.getByTestId('active-chip-q')
  assert.ok(qChip.textContent?.includes('"MacBook"'))

  assert.ok(screen.getByTestId('clear-all-filters-button'))
})

test('ItemsFilterBar: clicking individual chip close button calls onFilterChange to clear that filter', () => {
  const filterUpdates: ItemsFilterUpdates[] = []

  renderFilterBar({
    params: { category_id: 'cat-1', status: 'damaged' },
    onFilterChange: (updates) => filterUpdates.push(updates),
  })

  // Click remove category chip
  const removeCategoryBtn = screen.getByLabelText('ลบตัวกรอง หมวดหมู่')
  fireEvent.click(removeCategoryBtn)
  assert.deepEqual(filterUpdates[0], { category_id: '' })

  // Click remove status chip
  const removeStatusBtn = screen.getByLabelText('ลบตัวกรอง สถานะ')
  fireEvent.click(removeStatusBtn)
  assert.deepEqual(filterUpdates[1], { status: '' })
})

test('ItemsFilterBar: clicking "ล้างตัวกรองทั้งหมด" calls onResetFilters', () => {
  let resetCalled = false

  renderFilterBar({
    params: { category_id: 'cat-1', status: 'active', location_id: 'loc-1' },
    onResetFilters: () => {
      resetCalled = true
    },
  })

  const clearAllBtn = screen.getByTestId('clear-all-filters-button')
  fireEvent.click(clearAllBtn)

  assert.equal(resetCalled, true, 'onResetFilters should be called')
})

test('ItemsFilterBar: changing select dropdown invokes onFilterChange', () => {
  const filterUpdates: ItemsFilterUpdates[] = []

  renderFilterBar({
    onFilterChange: (updates) => filterUpdates.push(updates),
  })

  // Change category select
  const catSelect = screen.getByLabelText('กรองตามหมวดหมู่')
  fireEvent.change(catSelect, { target: { value: 'cat-2' } })
  assert.deepEqual(filterUpdates[0], { category_id: 'cat-2' })

  // Change status select with valid option value
  const statusSelect = screen.getByLabelText('กรองตามสถานะ')
  fireEvent.change(statusSelect, { target: { value: 'waiting_repair' } })
  assert.deepEqual(filterUpdates[1], { status: 'waiting_repair' })
})

test('ItemsFilterBar: renders batch print by location button when location_id is selected', () => {
  let batchPrintCalled = false

  renderFilterBar({
    params: { location_id: 'loc-1' },
    localItemsCount: 8,
    onBatchPrintLocation: () => {
      batchPrintCalled = true
    },
  })

  const printBtn = screen.getByRole('button', { name: /พิมพ์ป้ายทั้งสถานที่ \(8 ชิ้น\)/i })
  assert.ok(printBtn)

  fireEvent.click(printBtn)
  assert.equal(batchPrintCalled, true)
})

test('ItemsFilterBar: export button disables when isExporting is true', () => {
  const { rerender } = renderFilterBar({ isExporting: false })
  const exportBtn = screen.getByRole('button', { name: /ดาวน์โหลด Excel/i })
  assert.equal(exportBtn.hasAttribute('disabled'), false)

  rerender(
    <ItemsFilterBar
      searchVal=""
      onSearchChange={() => {}}
      onSearchClear={() => {}}
      params={{}}
      categories={mockCategories}
      locations={mockLocations}
      onFilterChange={() => {}}
      onResetFilters={() => {}}
      folderValuation={1000}
      localItemsCount={1}
      isExporting={true}
      onExport={() => {}}
    />
  )

  assert.equal(screen.getByRole('button', { name: /ดาวน์โหลด Excel/i }).hasAttribute('disabled'), true)
})

test('ItemsFilterBar: renders quick clear filters button in dropdown row when filters are active', () => {
  let resetCalled = false

  renderFilterBar({
    params: { category_id: 'cat-1' },
    onResetFilters: () => {
      resetCalled = true
    },
  })

  // Quick reset button in the filters row
  const quickClearBtn = screen.getByRole('button', { name: 'ล้างตัวกรอง' })
  assert.ok(quickClearBtn)
  fireEvent.click(quickClearBtn)
  assert.equal(resetCalled, true, 'clicking quick clear filters button should call onResetFilters')
})

test('ItemsFilterBar: search input has matching h-9 height class with select dropdowns', () => {
  renderFilterBar()
  const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ, เลขครุภัณฑ์, Serial...')
  assert.ok(searchInput.classList.contains('h-9'), 'search input should have h-9 height for enterprise visual rhythm')
  assert.ok(searchInput.classList.contains('text-xs'), 'search input should have text-xs font size')
})

