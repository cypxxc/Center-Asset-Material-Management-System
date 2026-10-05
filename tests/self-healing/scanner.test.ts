import test from 'node:test'
import assert from 'node:assert/strict'
import { runDiagnostics } from '@/lib/self-healing/scanner'

test('scanner reports 100 health score when zero issues exist', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Laptop', asset_no: 'A-001', serial_no: 'S-001', category_id: 'cat-1', location_id: 'loc-1', quantity: 1 },
      { id: '2', item_name: 'Paper', asset_no: null, serial_no: null, category_id: 'cat-1', location_id: null, quantity: 10 },
    ],
    fetchCategoryIds: async () => new Set(['cat-1']),
    fetchLocationIds: async () => new Set(['loc-1']),
    getCachedCount: async () => 2,
  })

  assert.equal(report.healthScore, 100)
  assert.equal(report.totalIssues, 0)
  assert.equal(report.issues.length, 0)
})

test('scanner detects STALE_CACHE when cached item count differs from live items', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Laptop', asset_no: 'A-001', serial_no: 'S-001', category_id: 'cat-1', location_id: 'loc-1', quantity: 1 },
    ],
    fetchCategoryIds: async () => new Set(['cat-1']),
    fetchLocationIds: async () => new Set(['loc-1']),
    getCachedCount: async () => 5, // Stale!
  })

  assert.equal(report.totalIssues, 1)
  const issue = report.issues[0]
  assert.equal(issue.code, 'STALE_CACHE')
  assert.equal(issue.severity, 'LOW')
  assert.equal(issue.autoHealable, true)
  assert.equal(report.healthScore, 95) // 100 - 5
})

test('scanner detects ORPHAN_RELATION when category_id or location_id is missing from reference sets', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Chair', asset_no: 'A-001', serial_no: null, category_id: 'missing-cat', location_id: 'missing-loc', quantity: 1 },
    ],
    fetchCategoryIds: async () => new Set(['valid-cat']),
    fetchLocationIds: async () => new Set(['valid-loc']),
    getCachedCount: async () => 1,
  })

  assert.equal(report.totalIssues, 1)
  const issue = report.issues[0]
  assert.equal(issue.code, 'ORPHAN_RELATION')
  assert.equal(issue.severity, 'MEDIUM')
  assert.equal(issue.autoHealable, true)
  assert.equal(report.healthScore, 90) // 100 - 10
})

test('scanner detects DUPLICATE_IDENTIFIER for duplicate asset_no or serial_no across distinct items', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Item A', asset_no: 'DUP-01', serial_no: 'SER-01', category_id: null, location_id: null, quantity: 1 },
      { id: '2', item_name: 'Item B', asset_no: 'DUP-01', serial_no: 'SER-02', category_id: null, location_id: null, quantity: 1 },
      { id: '3', item_name: 'Item C', asset_no: 'DUP-02', serial_no: 'SER-01', category_id: null, location_id: null, quantity: 1 },
    ],
    fetchCategoryIds: async () => new Set(),
    fetchLocationIds: async () => new Set(),
    getCachedCount: async () => 3,
  })

  const assetDup = report.issues.find((i) => i.code === 'DUPLICATE_IDENTIFIER' && (i.details as any).type === 'asset_no')
  const serialDup = report.issues.find((i) => i.code === 'DUPLICATE_IDENTIFIER' && (i.details as any).type === 'serial_no')

  assert.ok(assetDup, 'Should detect duplicate asset_no')
  assert.ok(serialDup, 'Should detect duplicate serial_no')
  assert.equal(assetDup?.severity, 'HIGH')
  assert.equal(assetDup?.autoHealable, false)
  // Deduct 25 for each HIGH issue: 100 - 25 - 25 = 50
  assert.equal(report.healthScore, 50)
})

test('scanner detects INCONSISTENT_STOCK when item quantity is negative', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Negative Stock Item', asset_no: 'NEG-1', serial_no: null, category_id: null, location_id: null, quantity: -5 },
    ],
    fetchCategoryIds: async () => new Set(),
    fetchLocationIds: async () => new Set(),
    getCachedCount: async () => 1,
  })

  assert.equal(report.totalIssues, 1)
  const issue = report.issues[0]
  assert.equal(issue.code, 'INCONSISTENT_STOCK')
  assert.equal(issue.severity, 'MEDIUM')
  assert.equal(issue.autoHealable, false)
  assert.equal(report.healthScore, 90) // 100 - 10
})

test('scanner clamps health score to 0 when multiple severe issues accumulate', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'A', asset_no: 'DUP-1', serial_no: 'SER-1', category_id: 'bad-1', location_id: null, quantity: -1 },
      { id: '2', item_name: 'B', asset_no: 'DUP-1', serial_no: 'SER-2', category_id: 'bad-2', location_id: null, quantity: -1 },
      { id: '3', item_name: 'C', asset_no: 'DUP-2', serial_no: 'SER-1', category_id: 'bad-3', location_id: null, quantity: -1 },
      { id: '4', item_name: 'D', asset_no: 'DUP-2', serial_no: 'SER-3', category_id: 'bad-4', location_id: null, quantity: -1 },
      { id: '5', item_name: 'E', asset_no: 'DUP-3', serial_no: 'SER-4', category_id: 'bad-5', location_id: null, quantity: -1 },
      { id: '6', item_name: 'F', asset_no: 'DUP-3', serial_no: 'SER-5', category_id: 'bad-6', location_id: null, quantity: -1 },
    ],
    fetchCategoryIds: async () => new Set(),
    fetchLocationIds: async () => new Set(),
    getCachedCount: async () => 999,
  })

  assert.equal(report.healthScore, 0)
})

test('scanner ignores null/whitespace identifiers and null relations without errors', async () => {
  const report = await runDiagnostics({
    fetchItems: async () => [
      { id: '1', item_name: 'Empty 1', asset_no: '', serial_no: '   ', category_id: null, location_id: null, quantity: 10 },
      { id: '2', item_name: 'Empty 2', asset_no: '   ', serial_no: '', category_id: null, location_id: null, quantity: 5 },
      { id: '3', item_name: 'Nulls', asset_no: null, serial_no: null, category_id: null, location_id: null, quantity: 0 },
    ],
    fetchCategoryIds: async () => new Set(),
    fetchLocationIds: async () => new Set(),
    getCachedCount: async () => 3,
  })

  assert.equal(report.healthScore, 100)
  assert.equal(report.totalIssues, 0)
  assert.equal(report.issues.length, 0)
  assert.ok(!Number.isNaN(Date.parse(report.timestamp)))
})

