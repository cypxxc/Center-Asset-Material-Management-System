import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('dashboard and item-list-client use next/dynamic for heavy components', () => {
  const chartPath = path.join(process.cwd(), 'components/dashboard/dashboard-acquisition-chart.tsx')
  const itemListClientPath = path.join(process.cwd(), 'features/items/components/item-list-client.tsx')

  assert.ok(fs.existsSync(chartPath), 'components/dashboard/dashboard-acquisition-chart.tsx must exist')
  assert.ok(fs.existsSync(itemListClientPath), 'features/items/components/item-list-client.tsx must exist')

  const chartContent = fs.readFileSync(chartPath, 'utf8')
  const itemListContent = fs.readFileSync(itemListClientPath, 'utf8')

  assert.ok(chartContent.includes("dynamic("), 'Dashboard acquisition chart must use next/dynamic for chart client')
  assert.ok(itemListContent.includes("dynamic("), 'Item list client must use next/dynamic for AssetTagModal')
})
