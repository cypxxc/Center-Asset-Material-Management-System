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

test('Sidebar exposes one active inventory entry for every inventory classification', () => {
  mockPathname = '/items'
  mockSearchParams = new URLSearchParams()

  renderSidebar()

  const inventoryLink = screen.getByRole('link', { name: 'ครุภัณฑ์' })
  assert.equal(inventoryLink.getAttribute('href'), '/items')
  assert.equal(inventoryLink.getAttribute('aria-current'), 'page')
  const materialLink = screen.getByRole('link', { name: 'วัสดุ' })
  assert.ok(materialLink)
  assert.equal(materialLink.getAttribute('href'), '/materials')
  const centralLink = screen.getByRole('link', { name: 'วัสดุ - ครุภัณฑ์คงคลัง' })
  assert.ok(centralLink)
  assert.equal(centralLink.getAttribute('href'), '/central-items')
  assert.equal(screen.queryByRole('link', { name: /จัดการผู้ใช้งาน/ }), null)
})

test('Sidebar renders collapsible mode, admin section and handles RBAC properly', () => {
  mockPathname = '/dashboard'
  mockSearchParams = new URLSearchParams()

  const { container } = renderSidebar()

  // Verify dashboard link is active
  const dashboardLink = screen.getByRole('link', { name: /Dashboard/i })
  assert.equal(dashboardLink.getAttribute('aria-current'), 'page')

  // Verify settings link exists
  const settingsLink = screen.getByRole('link', { name: /ตั้งค่าระบบ/ })
  assert.ok(settingsLink)

  // Verify toggle button for compact mode exists
  const toggleBtn = screen.getByRole('button', { name: 'ย่อแถบเมนู' })
  assert.ok(toggleBtn)

  // Aside element is rendered
  const aside = container.querySelector('aside')
  assert.ok(aside)
  assert.ok(aside.classList.contains('w-50'))
})
