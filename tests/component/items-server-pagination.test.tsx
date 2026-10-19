import '../setup/dom'
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// This component test exercises pagination UI without live Supabase realtime channels
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

afterEach(() => {
  cleanup()
})

import { ItemsExplorerClient, getPageNumbers } from '../../app/(dashboard)/items/items-explorer-client'
import { buildItemsUrl } from '../../features/items/hooks/use-items-filter'
import { ToastProvider } from '../../components/ui/toast'
import type { ItemListRow, ItemListSearchParams } from '../../features/items/types'
import type { BulkItemUpdates } from '../../features/items/bulk-edit'
import type { ActionResponse } from '../../lib/actions-helper'
import { ITEMS_PAGE_SIZE } from '../../features/items/list-params'

function createMockItems(count: number, startIndex = 0): ItemListRow[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i + 1
    return {
      id: `item-${idx}`,
      item_name: `พัสดุรายการที่ ${idx}`,
      item_type: idx % 2 === 0 ? 'asset' : 'material',
      quantity: 1,
      unit_price: 1000 * idx,
      asset_no: `ASSET-2026-${String(idx).padStart(4, '0')}`,
      serial_no: `SN-${String(idx).padStart(4, '0')}`,
      responsible_person: `ผู้ดูแลคนที่ ${idx}`,
      status: 'active',
      updated_at: new Date(2026, 0, idx).toISOString(),
      category: { id: 'cat-1', name: 'หมวดหมู่ทดสอบ' },
      unit: { id: 'unit-1', name: 'ชิ้น' },
      location: { id: 'loc-1', name: 'ห้องจัดเก็บ' },
      brand: 'Brand-X',
      model: 'Model-Y',
      note: null,
      image_url: null,
    }
  })
}

interface ExplorerProps {
  items: ItemListRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  userId: string
  params: ItemListSearchParams
  userCanWrite: boolean
  userCanDelete: boolean
  locations: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  units: { id: string; name: string }[]
  bulkUpdateAction?: (ids: string[], updates: BulkItemUpdates) => Promise<ActionResponse>
  bulkDeleteAction?: (ids: string[]) => Promise<ActionResponse>
}

const defaultProps: ExplorerProps = {
  items: createMockItems(50, 0),
  total: 125,
  page: 1,
  pageSize: 50,
  totalPages: 3,
  userId: 'user-test',
  params: { type: 'asset' },
  userCanWrite: true,
  userCanDelete: true,
  locations: [{ id: 'loc-1', name: 'ห้องจัดเก็บ' }],
  categories: [{ id: 'cat-1', name: 'หมวดหมู่ทดสอบ' }],
  units: [{ id: 'unit-1', name: 'ชิ้น' }],
}

function renderExplorer(props: Partial<ExplorerProps> = {}) {
  const mergedProps = { ...defaultProps, ...props }
  return render(
    <ToastProvider>
      <ItemsExplorerClient {...mergedProps} />
    </ToastProvider>
  )
}

test('getPageNumbers handles edge cases, ellipsis, and boundaries', () => {
  // <= 7 pages: all shown without ellipsis
  assert.deepEqual(getPageNumbers(1, 1), [1])
  assert.deepEqual(getPageNumbers(1, 5), [1, 2, 3, 4, 5])
  assert.deepEqual(getPageNumbers(4, 7), [1, 2, 3, 4, 5, 6, 7])

  // > 7 pages near start
  assert.deepEqual(getPageNumbers(1, 10), [1, 2, 3, 4, 5, 'ellipsis', 10])
  assert.deepEqual(getPageNumbers(3, 10), [1, 2, 3, 4, 5, 'ellipsis', 10])

  // > 7 pages in middle
  assert.deepEqual(getPageNumbers(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
  assert.deepEqual(getPageNumbers(6, 10), [1, 'ellipsis', 5, 6, 7, 'ellipsis', 10])

  // > 7 pages near end
  assert.deepEqual(getPageNumbers(8, 10), [1, 'ellipsis', 6, 7, 8, 9, 10])
  assert.deepEqual(getPageNumbers(10, 10), [1, 'ellipsis', 6, 7, 8, 9, 10])
})

test('buildItemsUrl supports page parameter and normalizes page 1', () => {
  // Page 1 is omitted from URL to keep URLs canonical
  assert.equal(buildItemsUrl('/items', { type: 'asset', page: '1' }), '/items?type=asset')
  // Page > 1 is included
  assert.equal(buildItemsUrl('/items', { type: 'asset', page: '2' }), '/items?type=asset&page=2')
  assert.equal(buildItemsUrl('/items', { type: 'asset', page: '5' }), '/items?type=asset&page=5')
})

test('first page displays exactly 50 items without virtual spacers', () => {
  const { container } = renderExplorer()

  // 1 header row + 50 items = 51 rows
  const rows = screen.getAllByRole('row')
  assert.equal(rows.length, 51)
  assert.ok(screen.getByText('พัสดุรายการที่ 1'))
  assert.ok(screen.getByText('พัสดุรายการที่ 50'))
  assert.equal(screen.queryByText('พัสดุรายการที่ 51'), null)

  // Verify NO virtual spacer rows exist in DOM
  assert.equal(container.querySelector('tr[aria-hidden="true"]'), null)
  assert.equal(container.querySelector('[key="__virtual-top-spacer__"]'), null)
  assert.equal(container.querySelector('[key="__virtual-bottom-spacer__"]'), null)

  // Verify pagination summary text
  assert.ok(screen.getByText('แสดง 1–50 จาก 125 รายการ'))

  // Previous button is disabled on page 1
  const prevBtn = screen.getByRole('button', { name: 'หน้าก่อนหน้า' })
  assert.equal((prevBtn as HTMLButtonElement).disabled, true)

  // Next button is enabled
  const nextBtn = screen.getByRole('button', { name: 'หน้าถัดไป' })
  assert.equal((nextBtn as HTMLButtonElement).disabled, false)
})

test('last page displays remaining items correctly with next button disabled', () => {
  // Page 3 of 125 items: items 101 to 125 (25 items)
  const page3Items = createMockItems(25, 100)
  renderExplorer({
    ...defaultProps,
    items: page3Items,
    total: 125,
    page: 3,
    pageSize: 50,
    totalPages: 3,
    params: { type: 'asset', page: '3' },
  })

  // 1 header row + 25 items = 26 rows
  const rows = screen.getAllByRole('row')
  assert.equal(rows.length, 26)
  assert.ok(screen.getByText('พัสดุรายการที่ 101'))
  assert.ok(screen.getByText('พัสดุรายการที่ 125'))

  // Pagination summary: "แสดง 101–125 จาก 125 รายการ"
  assert.ok(screen.getByText('แสดง 101–125 จาก 125 รายการ'))

  // Next button is disabled on last page
  const nextBtn = screen.getByRole('button', { name: 'หน้าถัดไป' })
  assert.equal((nextBtn as HTMLButtonElement).disabled, true)

  // Previous button is enabled
  const prevBtn = screen.getByRole('button', { name: 'หน้าก่อนหน้า' })
  assert.equal((prevBtn as HTMLButtonElement).disabled, false)
})

test('row selection and select all work across the 50 items on page', () => {
  renderExplorer()

  // Select all on current page
  const selectAllCheckbox = screen.getByLabelText('เลือกทุกรายการที่โหลดอยู่')
  fireEvent.click(selectAllCheckbox)
  assert.ok(screen.getByText('เลือกอยู่ 50 รายการ'))

  // Deselect all
  fireEvent.click(selectAllCheckbox)
  assert.equal(screen.queryByText('เลือกอยู่ 50 รายการ'), null)

  // Toggle single item
  fireEvent.click(screen.getByLabelText('เลือก พัสดุรายการที่ 1'))
  assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))
})

test('deleting the last remaining item on a page navigates to previous page', async () => {
  let deletedIds: string[] = []
  let navigatedUrl = ''

  // Mock next/navigation useRouter
  const nextNavigationPath = require.resolve('next/navigation')
  const nextNavigation = require.cache[nextNavigationPath]?.exports as {
    useRouter: () => { push: (url: string) => void; refresh: () => void }
  }
  const originalPush = nextNavigation.useRouter().push
  nextNavigation.useRouter = () => ({
    push: (url: string) => { navigatedUrl = url },
    refresh: () => {},
  })

  try {
    // 1 item left on page 2
    const singleItem = createMockItems(1, 50)
    window.confirm = () => true

    renderExplorer({
      ...defaultProps,
      items: singleItem,
      total: 51,
      page: 2,
      pageSize: 50,
      totalPages: 2,
      params: { type: 'asset', page: '2' },
      bulkDeleteAction: async (ids: string[]) => {
        deletedIds = ids
        return { success: true, message: 'ลบเรียบร้อย' }
      },
    })

    // Select the only item
    fireEvent.click(screen.getByLabelText('เลือก พัสดุรายการที่ 51'))
    assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

    // Click delete
    const deleteBtn = screen.getByText('ลบทั้งหมด')
    await act(async () => {
      fireEvent.click(deleteBtn)
    })

    assert.deepEqual(deletedIds, ['item-51'])
    // Because the last item on page 2 was deleted, it navigated back to page 1
    assert.equal(navigatedUrl, '/items?type=asset')
  } finally {
    nextNavigation.useRouter = () => ({ push: originalPush, refresh: () => {} })
  }
})

test('failed delete rolls back state and restores items', async () => {
  const singleItem = createMockItems(1, 0)
  window.confirm = () => true

  renderExplorer({
    ...defaultProps,
    items: singleItem,
    total: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    params: { type: 'asset' },
    bulkDeleteAction: async () => {
      return { success: false, message: 'ลบไม่สำเร็จ สิทธิ์ไม่เพียงพอ' }
    },
  })

  fireEvent.click(screen.getByLabelText('เลือก พัสดุรายการที่ 1'))
  const deleteBtn = screen.getByText('ลบทั้งหมด')

  await act(async () => {
    fireEvent.click(deleteBtn)
  })

  // Item is restored after rollback
  assert.ok(screen.getByText('พัสดุรายการที่ 1'))
  // Error modal displays message
  assert.ok(screen.getByText('ลบไม่สำเร็จ สิทธิ์ไม่เพียงพอ'))
})

test('ITEMS_PAGE_SIZE constant is exactly 50', () => {
  assert.equal(ITEMS_PAGE_SIZE, 50)
})
