import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'

test('dashboard layout starts layout data query while the current profile is pending', async () => {
  let resolveProfile!: (value: unknown) => void
  const profile = new Promise(resolve => { resolveProfile = resolve })
  let layoutDataCalled = false

  function mockModule(path: string, exports: object) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }

  mockModule('../../features/auth/queries', { getCurrentProfile: () => profile })
  mockModule('../../features/items/queries', {
    getDashboardLayoutData: async () => {
      layoutDataCalled = true
      return {
        sidebarData: { totalItems: 0, pendingAudits: 0 },
        references: { categories: [], locations: [], units: [] },
      }
    },
  })
  mockModule('../../components/layout/sidebar', { Sidebar: () => null })
  mockModule('../../components/layout/header', { Header: () => null })
  mockModule('../../features/items/components/new-item-dialog-provider', {
    NewItemDialogProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
  })
  mockModule('../../components/ui/toast', {
    ToastProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
  })
  mockModule('next/navigation', { redirect: () => {} })

  const { default: DashboardLayout } = await import('../../app/(dashboard)/layout')
  const pending = DashboardLayout({ children: null })

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(layoutDataCalled, true, 'getDashboardLayoutData should be called while profile is pending')
  } finally {
    resolveProfile({ id: 'test-user', is_active: true, role: 'admin' })
    await pending
  }
})
