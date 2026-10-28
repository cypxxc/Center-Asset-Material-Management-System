import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  DashboardActionQueue,
  ActionQueueSkeleton,
  type FormattedLowStockItem,
} from '../../components/dashboard/dashboard-action-queue'
import type { UrgentDamagedItem } from '../../features/items/types'

const sampleDamagedItems: UrgentDamagedItem[] = [
  {
    id: 'item-damaged-1',
    item_name: 'เครื่องพิมพ์เลเซอร์ HP LaserJet Pro',
    asset_no: 'AS-2024-0012',
    locationName: 'ห้องธุรการ ชั้น 2',
    status: 'damaged',
    updated_at: '2026-10-18T10:00:00Z',
    image_url: 'https://example.com/printer.jpg',
  },
  {
    id: 'item-damaged-2',
    item_name: 'เก้าอี้สำนักงานเพื่อสุขภาพ',
    asset_no: 'AS-2024-0089',
    locationName: 'ห้องประชุมใหญ่',
    status: 'waiting_repair',
    updated_at: '2026-10-17T14:30:00Z',
    image_url: null,
  },
]

const sampleLowStockItems: FormattedLowStockItem[] = [
  {
    id: 'item-stock-1',
    item_name: 'กระดาษ Double A A4 80gsm',
    quantity: 2,
    locationName: 'คลังวัสดุกลาง',
    unit_name: 'รีม',
  },
  {
    id: 'item-stock-2',
    item_name: 'หมึกพิมพ์ HP Black Toner',
    quantity: 1,
    locationName: 'คลังพัสดุไอที',
    unit_name: null,
  },
]

test('DashboardActionQueue has id="action-queue" and scroll-mt-6 on the container', async () => {
  const element = await DashboardActionQueue({
    damagedItems: sampleDamagedItems,
    lowStockItems: sampleLowStockItems,
  })
  const { container } = render(element)

  const queueContainer = container.querySelector('#action-queue')
  assert.ok(queueContainer, 'Container must have id="action-queue"')
  assert.ok(queueContainer.classList.contains('scroll-mt-6'), 'Container must have scroll-mt-6')
})

test('DashboardActionQueue switches tabs using left/right arrow keys', async () => {
  const element = await DashboardActionQueue({
    damagedItems: sampleDamagedItems,
    lowStockItems: sampleLowStockItems,
  })
  render(element)

  const damagedTab = screen.getByRole('tab', { name: /พัสดุชำรุดและรอซ่อม/ })
  const tablist = screen.getByRole('tablist')

  assert.equal(damagedTab.getAttribute('aria-selected'), 'true')

  // Press ArrowRight to switch to low-stock tab
  fireEvent.keyDown(tablist, { key: 'ArrowRight' })

  const lowStockTab = screen.getByRole('tab', { name: /พัสดุใกล้หมดคลัง/ })
  assert.equal(lowStockTab.getAttribute('aria-selected'), 'true')
  assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'))

  // Press ArrowLeft to switch back to damaged tab
  fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
  assert.equal(damagedTab.getAttribute('aria-selected'), 'true')
  assert.ok(screen.getByText('เครื่องพิมพ์เลเซอร์ HP LaserJet Pro'))
})

test('DashboardActionQueue renders damaged items tab by default with details and badges', async () => {
  const element = await DashboardActionQueue({
    damagedItems: sampleDamagedItems,
    lowStockItems: sampleLowStockItems,
  })
  render(element)

  // Verify tab headers and badges
  assert.ok(screen.getByText('พัสดุชำรุดและรอซ่อม'))
  assert.ok(screen.getByText('พัสดุใกล้หมดคลัง'))

  // Verify damaged items details
  assert.ok(screen.getByText('เครื่องพิมพ์เลเซอร์ HP LaserJet Pro'))
  assert.ok(screen.getByText('AS-2024-0012'))
  assert.ok(screen.getByText('ห้องธุรการ ชั้น 2'))
  assert.ok(screen.getByText('ชำรุด'))

  assert.ok(screen.getByText('เก้าอี้สำนักงานเพื่อสุขภาพ'))
  assert.ok(screen.getByText('AS-2024-0089'))
  assert.ok(screen.getByText('ห้องประชุมใหญ่'))
  assert.ok(screen.getByText('รอส่งซ่อม'))

  // Verify action links
  const viewLinks = screen.getAllByRole('link', { name: /ดูข้อมูล/ })
  assert.ok(viewLinks.length >= 2)
  assert.ok(viewLinks.some((l) => l.getAttribute('href') === '/items/item-damaged-1'))
  assert.ok(viewLinks.some((l) => l.getAttribute('href') === '/items/item-damaged-2'))
})

test('DashboardActionQueue switches to low stock tab when clicked', async () => {
  const element = await DashboardActionQueue({
    damagedItems: sampleDamagedItems,
    lowStockItems: sampleLowStockItems,
  })
  render(element)

  // Click low stock tab
  const lowStockTab = screen.getByRole('tab', { name: /พัสดุใกล้หมดคลัง/ })
  fireEvent.click(lowStockTab)

  // Low stock items should now be visible
  assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'))
  assert.ok(screen.getByText('2 รีม'))
  assert.ok(screen.getByText('คลังวัสดุกลาง'))

  assert.ok(screen.getByText('หมึกพิมพ์ HP Black Toner'))
  assert.ok(screen.getByText('1 ชิ้น')) // fallback unit_name
  assert.ok(screen.getByText('คลังพัสดุไอที'))

  // Warning badges
  const warningBadges = screen.getAllByText('ต่ำกว่าเกณฑ์')
  assert.equal(warningBadges.length, 2)

  // Links for low stock items
  const viewLinks = screen.getAllByRole('link', { name: /ดูข้อมูล/ })
  assert.ok(viewLinks.some((l) => l.getAttribute('href') === '/items/item-stock-1'))
  assert.ok(viewLinks.some((l) => l.getAttribute('href') === '/items/item-stock-2'))
})

test('DashboardActionQueue displays empty state when damaged items list is empty', async () => {
  const element = await DashboardActionQueue({
    damagedItems: [],
    lowStockItems: sampleLowStockItems,
  })
  render(element)

  assert.ok(
    screen.getByText('ไม่มีพัสดุชำรุดหรือรอซ่อมในขณะนี้ อุปกรณ์ทั้งหมดอยู่ในสภาพพร้อมใช้งาน')
  )
})

test('DashboardActionQueue displays empty state when low-stock items list is empty', async () => {
  const element = await DashboardActionQueue({
    damagedItems: sampleDamagedItems,
    lowStockItems: [],
  })
  render(element)

  // Switch to low-stock tab
  const lowStockTab = screen.getByRole('tab', { name: /พัสดุใกล้หมดคลัง/ })
  fireEvent.click(lowStockTab)

  assert.ok(screen.getByText('ระดับพัสดุคงคลังทั้งหมดอยู่ในเกณฑ์ปกติ'))
})

test('DashboardActionQueue displays emerald badge when both queues are clear', async () => {
  const element = await DashboardActionQueue({
    damagedItems: [],
    lowStockItems: [],
  })
  render(element)

  assert.ok(screen.getByText('คิวงานเรียบร้อย'))
})

test('ActionQueueSkeleton renders tabs and 3 animated skeleton rows with animate-pulse', () => {
  const { container } = render(React.createElement(ActionQueueSkeleton))

  const skeletonRoot = container.querySelector('[data-testid="action-queue-skeleton"]')
  assert.ok(skeletonRoot, 'Skeleton root should exist')

  const pulseElements = container.querySelectorAll('.animate-pulse')
  assert.ok(pulseElements.length >= 1, 'Should contain animate-pulse elements')

  const rows = container.querySelectorAll('[data-testid="skeleton-row"]')
  assert.equal(rows.length, 3, 'Should render 3 skeleton rows')
})
