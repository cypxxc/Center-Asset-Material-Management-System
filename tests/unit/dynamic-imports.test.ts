import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('dashboard and item-list-client use next/dynamic for heavy components', () => {
  const dashboardPath = path.join(process.cwd(), 'app/(dashboard)/dashboard/page.tsx')
  const itemListClientPath = path.join(process.cwd(), 'features/items/components/item-list-client.tsx')

  assert.ok(fs.existsSync(dashboardPath), 'app/(dashboard)/dashboard/page.tsx must exist')
  assert.ok(fs.existsSync(itemListClientPath), 'features/items/components/item-list-client.tsx must exist')

  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8')
  const itemListContent = fs.readFileSync(itemListClientPath, 'utf8')

  assert.ok(dashboardContent.includes("dynamic("), 'Dashboard page must use next/dynamic for chart')
  assert.ok(itemListContent.includes("dynamic("), 'Item list client must use next/dynamic for AssetTagModal')
})
