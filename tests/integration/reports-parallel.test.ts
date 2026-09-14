import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'

test('reports starts independent reads while the current profile is pending', async () => {
  let resolveProfile!: (value: unknown) => void
  const profile = new Promise(resolve => { resolveProfile = resolve })
  const started = new Set<string>()
  function mockModule(path: string, exports: object) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  mockModule('../../features/auth/queries', { getCurrentProfile: () => profile })
  mockModule('../../features/items/queries', {
    getItemReferences: async () => { started.add('references'); return { categories: [], locations: [] } },
  })
  mockModule('../../features/reports/queries', {
    getReportStats: async () => { started.add('stats'); return {} },
    getReportItemsList: async () => { started.add('items'); return { items: [] } },
  })
  mockModule('../../features/depreciation/queries', {
    getDepreciationReport: async () => { started.add('depreciation'); return { items: [], totals: {} } },
  })
  mockModule('../../features/reports/components/reports-list', { ReportsList: () => null })
  mockModule('../../features/depreciation/components/depreciation-report', { DepreciationReport: () => null })
  const { default: ReportsPage } = await import('../../app/(dashboard)/reports/page')
  const pending = ReportsPage({ searchParams: Promise.resolve({}) })
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual([...started].sort(), ['depreciation', 'items', 'references', 'stats'])
  } finally {
    resolveProfile({ id: 'test-only', is_active: true })
    await pending
  }
})
