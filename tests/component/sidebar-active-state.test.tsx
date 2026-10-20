import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, cleanup } from '@testing-library/react'
import { NewItemDialogProvider } from '../../features/items/components/new-item-dialog-provider'

// Track current navigation state for mocks
let mockPathname = '/items'
let mockSearchParams = new URLSearchParams()

// Mock next/navigation
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextNavigation = require('next/navigation')
nextNavigation.usePathname = () => mockPathname
nextNavigation.useSearchParams = () => mockSearchParams
nextNavigation.useRouter = () => ({
  push: () => {},
  replace: () => {},
  refresh: () => {},
})

// Import component after mock
import { Sidebar } from '../../components/layout/sidebar'

const dummyProfile = {
  full_name: 'สมชาย ใจดี',
  display_name: 'สมชาย',
  email: 'somchai@example.com',
  role: 'admin',
}

const dummySidebarData = {
  categories: [
    { id: 'cat-1', name: 'คอมพิวเตอร์', count: 5 },
    { id: 'cat-2', name: 'เก้าอี้', count: 3 },
  ],
  locations: [
    { id: 'loc-1', name: 'ห้อง 101', count: 4 },
  ],
  counts: {
    total_assets: 8,
    total_supplies: 12,
    archive_count: 1,
    trash_count: 0,
  },
}

function renderSidebar() {
  return render(
    <NewItemDialogProvider categories={[]} locations={[]} units={[]}>
      <Sidebar profile={dummyProfile} sidebarData={dummySidebarData} />
    </NewItemDialogProvider>
  )
}

test.afterEach(() => {
  cleanup()
})

test('Sidebar active-state for exact /items highlights รายการทั้งหมด only', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams()

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })
  const locationsLink = screen.getByRole('link', { name: 'สถานที่' })

  assert.equal(allItemsLink.getAttribute('aria-current'), 'page')
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(suppliesLink.getAttribute('aria-current'), null)
  assert.equal(locationsLink.getAttribute('aria-current'), null)
})

test('Sidebar active-state for /items?q=monitor keeps รายการทั้งหมด active without conflicting highlights', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('q=monitor')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })
  const locationsLink = screen.getByRole('link', { name: 'สถานที่' })

  assert.equal(allItemsLink.getAttribute('aria-current'), 'page')
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(suppliesLink.getAttribute('aria-current'), null)
  assert.equal(locationsLink.getAttribute('aria-current'), null)
})

test('Sidebar active-state for /items?status=in_use keeps รายการทั้งหมด active without conflicting highlights', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('status=in_use')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })
  const locationsLink = screen.getByRole('link', { name: 'สถานที่' })

  assert.equal(allItemsLink.getAttribute('aria-current'), 'page')
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(suppliesLink.getAttribute('aria-current'), null)
  assert.equal(locationsLink.getAttribute('aria-current'), null)
})

test('Sidebar active-state for /items?type=asset highlights ครุภัณฑ์ only', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('type=asset')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })

  assert.equal(allItemsLink.getAttribute('aria-current'), null)
  assert.equal(assetsLink.getAttribute('aria-current'), 'page')
  assert.equal(suppliesLink.getAttribute('aria-current'), null)
})

test('Sidebar active-state for /items?type=material highlights วัสดุ only', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('type=material')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })

  assert.equal(allItemsLink.getAttribute('aria-current'), null)
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(suppliesLink.getAttribute('aria-current'), 'page')
})

test('Sidebar active-state for /items?type=asset&category_id=cat-1 does not highlight top-level all-items or top-level assets link', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('type=asset&category_id=cat-1')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const suppliesLink = screen.getByRole('link', { name: /^วัสดุ/ })

  assert.equal(allItemsLink.getAttribute('aria-current'), null)
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(suppliesLink.getAttribute('aria-current'), null)
})

test('Sidebar active-state for /items?location_id=loc-1 does not highlight top-level all-items or top-level locations link', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams('location_id=loc-1')

  renderSidebar()

  const allItemsLink = screen.getByRole('link', { name: 'รายการทั้งหมด' })
  const assetsLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  const locationsLink = screen.getByRole('link', { name: 'สถานที่' })

  assert.equal(allItemsLink.getAttribute('aria-current'), null)
  assert.equal(assetsLink.getAttribute('aria-current'), null)
  assert.equal(locationsLink.getAttribute('aria-current'), null)
})
