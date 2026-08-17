import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { render } from '@testing-library/react'
import { MetricsGridSkeleton, DashboardMetricsGrid } from '../../components/dashboard/dashboard-metrics-grid'
import { CategoryListSkeleton, DashboardCategoryList } from '../../components/dashboard/dashboard-category-list'
import { LowStockSkeleton, DashboardLowStockPanel } from '../../components/dashboard/dashboard-low-stock-panel'

test('migration 00033 contains hot-path performance composite indexes', () => {
  const sql = readFileSync('db/migrations/00033_hot_path_performance_indexes.sql', 'utf8')

  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_items_low_stock_material/i)
  assert.match(sql, /ON public\.items\s*\(quantity ASC\)/i)
  assert.match(sql, /WHERE item_type = 'material' AND deleted_at IS NULL AND quantity <= 5/i)

  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_items_explorer_search/i)
  assert.match(sql, /ON public\.items\s*\(deleted_at, item_type, category_id, location_id, created_at DESC\)/i)

  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_items_status_active/i)
  assert.match(sql, /ON public\.items\s*\(status, item_type\)/i)
  assert.match(sql, /WHERE deleted_at IS NULL/i)
})

test('dashboard skeleton components render fallback loading markup', () => {
  const { container: metricsContainer } = render(React.createElement(MetricsGridSkeleton))
  assert.ok(metricsContainer.querySelector('[data-testid="metrics-grid-skeleton"]'))
  assert.ok(metricsContainer.querySelectorAll('.animate-pulse').length >= 4)

  const { container: categoryContainer } = render(React.createElement(CategoryListSkeleton))
  assert.ok(categoryContainer.querySelector('[data-testid="category-list-skeleton"]'))
  assert.ok(categoryContainer.querySelectorAll('.animate-pulse').length >= 2)

  const { container: lowStockContainer } = render(React.createElement(LowStockSkeleton))
  assert.ok(lowStockContainer.querySelector('[data-testid="low-stock-skeleton"]'))
  assert.ok(lowStockContainer.querySelectorAll('.animate-pulse').length >= 1)
})

test('dashboard components and page are configured for React Suspense streaming', () => {
  assert.equal(typeof DashboardMetricsGrid, 'function')
  assert.equal(typeof DashboardCategoryList, 'function')
  assert.equal(typeof DashboardLowStockPanel, 'function')

  const pageContent = readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf8')

  assert.match(pageContent, /import\s*\{\s*Suspense\s*\}\s*from\s*'react'/)
  assert.match(pageContent, /fallback=\{<MetricsGridSkeleton \/>\}/)
  assert.match(pageContent, /fallback=\{<CategoryListSkeleton \/>\}/)
  assert.match(pageContent, /fallback=\{<LowStockSkeleton \/>\}/)
})

test('getLowStockItems is exported as a function in features/items/queries', async () => {
  const { getLowStockItems } = await import('../../features/items/queries')
  assert.equal(typeof getLowStockItems, 'function')
})

