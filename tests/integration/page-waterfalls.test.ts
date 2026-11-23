import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'

function mockModule(path: string, exports: object) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

// Mutable handlers to ensure clean per-test isolation
let currentProfileHandler: () => Promise<unknown> = async () => null
let settingsPageDataHandler: (tab?: string) => Promise<unknown> = async () => ({
  activeTab: 'categories',
  data: { categories: [], locations: [], units: [] },
})

// Mock domain query modules
mockModule('../../features/auth/queries', {
  getCurrentProfile: () => currentProfileHandler(),
})

mockModule('../../features/settings/queries', {
  getSettingsPageData: (tab?: string) => settingsPageDataHandler(tab),
})

// Mock client components and leaf UI widgets
mockModule('../../features/settings/components/metadata-sections', {
  CategorySection: () => null,
  LocationSection: () => null,
  UnitSection: () => null,
  ImportSection: () => null,
})

mockModule('../../components/ui/page-container', {
  PageContainer: ({ children }: { children?: React.ReactNode }) => children ?? null,
})

mockModule('../../components/ui/page-header', {
  PageHeader: () => null,
})

test('SettingsPage evaluates searchParams and getCurrentProfile concurrently without blocking', async () => {
  let resolveProfile!: (value: unknown) => void
  const profilePromise = new Promise(resolve => {
    resolveProfile = resolve
  })

  currentProfileHandler = () => profilePromise

  let searchParamsAwaited = false
  const searchParams = {
    then(onFulfilled: (val: unknown) => unknown, onRejected: (err: unknown) => unknown) {
      searchParamsAwaited = true
      return Promise.resolve({ tab: 'categories' }).then(onFulfilled, onRejected)
    },
  }

  let settingsDataCalled = false
  settingsPageDataHandler = async (tab?: string) => {
    settingsDataCalled = true
    return {
      activeTab: tab || 'categories',
      data: { categories: [], locations: [], units: [] },
    }
  }

  const { default: SettingsPage } = await import('../../app/(dashboard)/settings/page')
  const pending = SettingsPage({ searchParams: searchParams as unknown as Promise<{ tab?: string }> })

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      searchParamsAwaited,
      true,
      'searchParams should be awaited while getCurrentProfile is still pending'
    )
    assert.equal(
      settingsDataCalled,
      false,
      'getSettingsPageData should not be called until profile and searchParams resolve'
    )
  } finally {
    resolveProfile({ id: 'user-admin', role: 'admin', is_active: true })
    const element = await pending
    assert.ok(element, 'SettingsPage should render successfully')
    assert.equal(settingsDataCalled, true, 'getSettingsPageData should be called once promises resolve')
  }
})

test('SettingsPage runs getCurrentProfile concurrently even if searchParams is pending', async () => {
  let resolveSearchParams!: (value: { tab?: string }) => void
  const searchParamsPromise = new Promise<{ tab?: string }>(resolve => {
    resolveSearchParams = resolve
  })

  let profileCalled = false
  currentProfileHandler = async () => {
    profileCalled = true
    return { id: 'user-admin', role: 'admin', is_active: true }
  }

  const { default: SettingsPage } = await import('../../app/(dashboard)/settings/page')
  const pending = SettingsPage({ searchParams: searchParamsPromise })

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      profileCalled,
      true,
      'getCurrentProfile should be invoked immediately without waiting for searchParams'
    )
  } finally {
    resolveSearchParams({ tab: 'units' })
    const element = await pending
    assert.ok(element, 'SettingsPage should render successfully')
  }
})
