import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { DashboardMetricsGrid, MetricsGridSkeleton } from '../../components/dashboard/dashboard-metrics-grid'
import type { ReportStats } from '../../features/reports/types'
import type { LowStockDashboardItem } from '../../features/items/queries'

function createSampleStats(overrides: Partial<ReportStats> = {}): ReportStats {
  return {
    totalItems: 100,
    totalQuantity: 250,
    totalValue: 1250000,
    typeCounts: {
      asset: { count: 70, qty: 70 },
      material: { count: 30, qty: 180 },
    },
    statusCounts: {
      active: { count: 95, qty: 240 },
      damaged: { count: 3, qty: 3 },
      waiting_repair: { count: 2, qty: 2 },
      inactive: { count: 0, qty: 0 },
      disposed: { count: 0, qty: 0 },
    },
    categoryCounts: {},
    locationCount: 4,
    ...overrides,
  }
}

const sampleLowStock: LowStockDashboardItem[] = [
  { id: 'item-1', item_name: 'กระดาษ A4', quantity: 2, locationName: 'คลังพัสดุ 1' },
  { id: 'item-2', item_name: 'หมึกพิมพ์ HP', quantity: 1, locationName: 'คลังพัสดุ 2' },
  { id: 'item-3', item_name: 'ปากกาน้ำเงิน', quantity: 3, locationName: 'ห้องธุรการ' },
]

test('DashboardMetricsGrid renders all 4 Bento Cards with expected test values', async () => {
  const stats = createSampleStats()
  const element = await DashboardMetricsGrid({ stats, lowStockItems: sampleLowStock })
  render(element)

  // 1. Valuation Card
  assert.ok(screen.getByText('มูลค่าสินทรัพย์รวม'))
  assert.ok(screen.getByText('฿1,250,000'))
  assert.ok(screen.getByText('รวมครุภัณฑ์และพัสดุทั้งหมดในระบบ'))

  // 2. Composition Card
  assert.ok(screen.getByText('ครุภัณฑ์และพัสดุทั้งหมด'))
  assert.ok(screen.getByText('100 รายการ'))
  assert.ok(screen.getByText('ครุภัณฑ์ 70 | พัสดุ 30'))

  // 3. Readiness Card
  assert.ok(screen.getByText('ความพร้อมใช้งานของพัสดุ'))
  assert.ok(screen.getByText('95.0%'))
  assert.ok(screen.getByText('ใช้งานปกติ 95 | ชำรุด/ส่งซ่อม 5'))

  // 4. Urgent Action Card
  // 5 damaged/waiting_repair + 3 low stock = 8 items
  assert.ok(screen.getByText('รายการเร่งด่วน'))
  assert.ok(screen.getByText('8 รายการ'))
  assert.ok(screen.getByText('5 รายการรอซ่อม • 3 สต็อกต่ำ'))
})

test('DashboardMetricsGrid applies tabular-nums and tracking-tight to numeric displays', async () => {
  const stats = createSampleStats()
  const element = await DashboardMetricsGrid({ stats, lowStockItems: sampleLowStock })
  const { container } = render(element)

  const tabularElements = container.querySelectorAll('.tabular-nums')
  assert.ok(tabularElements.length >= 4, 'Should have at least 4 elements with tabular-nums')

  // Verify every main card header has tabular-nums and tracking-tight
  tabularElements.forEach((el) => {
    assert.ok(el.classList.contains('tracking-tight'), 'tabular element should have tracking-tight')
  })
})

test('DashboardMetricsGrid handles division by zero for readiness and ratios when totalItems is 0', async () => {
  const emptyStats = createSampleStats({
    totalItems: 0,
    totalQuantity: 0,
    totalValue: 0,
    typeCounts: {
      asset: { count: 0, qty: 0 },
      material: { count: 0, qty: 0 },
    },
    statusCounts: {
      active: { count: 0, qty: 0 },
      damaged: { count: 0, qty: 0 },
      waiting_repair: { count: 0, qty: 0 },
    },
  })

  const element = await DashboardMetricsGrid({ stats: emptyStats, lowStockItems: [] })
  render(element)

  // Readiness percentage should be 100.0% when totalItems = 0
  assert.ok(screen.getByText('100.0%'))
  assert.equal(screen.getAllByText('0 รายการ').length, 2)
  assert.ok(screen.getByText('฿0'))
})

test('DashboardMetricsGrid displays quick action link and proper rose-colored count on urgent card', async () => {
  const stats = createSampleStats({
    statusCounts: {
      active: { count: 50, qty: 50 },
      damaged: { count: 4, qty: 4 },
      waiting_repair: { count: 3, qty: 3 },
    },
  })

  const element = await DashboardMetricsGrid({ stats, lowStockItems: sampleLowStock })
  const { container } = render(element)

  // Urgent count = (4 + 3) + 3 = 10
  const urgentCountEl = screen.getByText('10 รายการ')
  assert.ok(urgentCountEl.classList.contains('text-rose-600'))
  assert.ok(urgentCountEl.classList.contains('dark:text-rose-400'))

  // Quick action link
  const actionLink = container.querySelector('a[href="#action-queue"]')
  assert.ok(actionLink, 'Should have quick action link targeting #action-queue')
  assert.ok(actionLink?.textContent?.includes('ตรวจสอบทันที'))
  assert.ok(actionLink?.classList.contains('text-rose-600'))
})

test('MetricsGridSkeleton renders 4 cards with animate-pulse and matching structure', () => {
  const { container } = render(React.createElement(MetricsGridSkeleton))

  const skeletonRoot = container.querySelector('[data-testid="metrics-grid-skeleton"]')
  assert.ok(skeletonRoot, 'Skeleton root should exist')

  const pulseCards = container.querySelectorAll('.animate-pulse')
  assert.equal(pulseCards.length, 4, 'Should render 4 animated skeleton cards')
})
