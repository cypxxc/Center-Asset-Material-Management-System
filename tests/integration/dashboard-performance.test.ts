import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { render } from '@testing-library/react'
import { MetricsGridSkeleton, DashboardMetricsGrid } from '../../components/dashboard/dashboard-metrics-grid'
import { CategoryListSkeleton, DashboardCategoryList } from '../../components/dashboard/dashboard-category-list'
import { ActionQueueSkeleton, DashboardActionQueue } from '../../components/dashboard/dashboard-action-queue'

test('dashboard skeleton components render fallback loading markup', () => {
  const { container: metricsContainer } = render(React.createElement(MetricsGridSkeleton))
  assert.ok(metricsContainer.querySelector('[data-testid="metrics-grid-skeleton"]'))
  assert.ok(metricsContainer.querySelectorAll('.animate-pulse').length >= 4)

  const { container: categoryContainer } = render(React.createElement(CategoryListSkeleton))
  assert.ok(categoryContainer.querySelector('[data-testid="category-list-skeleton"]'))
  assert.ok(categoryContainer.querySelectorAll('.animate-pulse').length >= 2)

  const { container: actionQueueContainer } = render(React.createElement(ActionQueueSkeleton))
  assert.ok(actionQueueContainer.querySelector('[data-testid="action-queue-skeleton"]'))
  assert.ok(actionQueueContainer.querySelectorAll('.animate-pulse').length >= 1)
})

test('dashboard components and page are configured for React Suspense streaming', () => {
  assert.equal(typeof DashboardMetricsGrid, 'function')
  assert.equal(typeof DashboardCategoryList, 'function')
  assert.equal(typeof DashboardActionQueue, 'function')

  const pageContent = readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf8')

  assert.match(pageContent, /import\s*\{\s*Suspense\s*\}\s*from\s*'react'/)
  assert.match(pageContent, /fallback=\{<AcquisitionChartSkeleton \/>\}/)
  assert.match(pageContent, /fallback=\{<AdminWorkQueueSkeleton \/>\}/)
})

test('dashboard defers the realtime subscription behind a client-only boundary', () => {
  const pageSource = readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf8')
  const boundarySource = readFileSync('components/dashboard/dashboard-realtime-boundary.tsx', 'utf8')
  const realtimeRefreshSource = readFileSync('hooks/use-realtime-refresh.ts', 'utf8')

  assert.match(
    pageSource,
    /import \{ DashboardRealtimeBoundary \} from '@\/components\/dashboard\/dashboard-realtime-boundary'/,
  )
  assert.match(boundarySource, /dynamic\(\s*\(\) => import\('@\/components\/realtime-refresh-bridge'\)/)
  assert.match(boundarySource, /ssr:\s*false/)
  assert.match(realtimeRefreshSource, /router\.refresh\(\)/)
  assert.match(realtimeRefreshSource, /new EventSource/)
})

test('getLowStockItems is exported as a function in features/items/queries', async () => {
  const { getLowStockItems } = await import('../../features/items/queries')
  assert.equal(typeof getLowStockItems, 'function')
})

