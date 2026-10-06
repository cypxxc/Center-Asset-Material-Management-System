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
let locationsOverviewHandler: () => Promise<unknown> = async () => ({ locations: [], items: [] })
let itemDetailPageDataHandler: (id: string) => Promise<unknown> = async () => ({
  item: null,
  auditLogs: [],
})

// Mock domain query modules
mockModule('../../features/auth/queries', {
  getCurrentProfile: () => currentProfileHandler(),
})

mockModule('../../features/settings/queries', {
  getSettingsPageData: (tab?: string) => settingsPageDataHandler(tab),
  getLocationsOverview: () => locationsOverviewHandler(),
})

mockModule('../../features/items/queries', {
  getItemDetailPageData: (id: string) => itemDetailPageDataHandler(id),
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

mockModule('../../app/(dashboard)/locations/locations-client', {
  LocationsClient: () => null,
})

mockModule('../../features/items/components/delete-item-button', {
  DeleteItemButton: () => null,
})

mockModule('../../components/ui/zoomable-image', {
  ZoomableImage: () => null,
})

mockModule('../../app/(dashboard)/items/[id]/item-audit-timeline', {
  ItemAuditTimeline: () => null,
})

mockModule('../../app/(dashboard)/items/[id]/item-detail-actions', {
  ItemDetailActions: () => null,
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

test('LocationsPage starts getLocationsOverview immediately while getCurrentProfile is still pending', async () => {
  let resolveProfile!: (value: unknown) => void
  const profilePromise = new Promise(resolve => {
    resolveProfile = resolve
  })

  currentProfileHandler = () => profilePromise

  let locationsOverviewCalled = false
  locationsOverviewHandler = async () => {
    locationsOverviewCalled = true
    return {
      locations: [{ id: 'loc-1', name: 'Main Office' }],
      items: [{ id: 'item-1', item_name: 'Desk' }],
    }
  }

  const { default: LocationsPage } = await import('../../app/(dashboard)/locations/page')
  const pending = LocationsPage()

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      locationsOverviewCalled,
      true,
      'getLocationsOverview should be called immediately while getCurrentProfile is pending'
    )
  } finally {
    resolveProfile({ id: 'user-staff', role: 'staff', is_active: true })
    const element = await pending
    assert.ok(element, 'LocationsPage should render successfully')
  }
})

test('ItemDetailPage evaluates params and getCurrentProfile concurrently', async () => {
  let resolveParams!: (value: { id: string }) => void
  const paramsPromise = new Promise<{ id: string }>(resolve => {
    resolveParams = resolve
  })

  let profileCalled = false
  currentProfileHandler = async () => {
    profileCalled = true
    return { id: 'user-staff', role: 'staff', is_active: true }
  }

  let itemDetailDataCalled = false
  let queriedItemId = ''
  itemDetailPageDataHandler = async (id: string) => {
    itemDetailDataCalled = true
    queriedItemId = id
    return {
      item: {
        id,
        item_name: 'Ergonomic Chair',
        item_type: 'asset',
        status: 'active',
        depreciation_enabled: false,
      },
      auditLogs: [],
    }
  }

  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')
  const pending = ItemDetailPage({ params: paramsPromise })

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      profileCalled,
      true,
      'getCurrentProfile should be invoked immediately while params is still pending'
    )
    assert.equal(
      itemDetailDataCalled,
      false,
      'getItemDetailPageData should not be invoked until params has resolved'
    )
  } finally {
    resolveParams({ id: 'item-999' })
    const element = await pending
    assert.ok(element, 'ItemDetailPage should render successfully')
    assert.equal(itemDetailDataCalled, true, 'getItemDetailPageData should be called once params resolves')
    assert.equal(queriedItemId, 'item-999', 'getItemDetailPageData should receive the resolved id')
  }
})

test('ItemDetailPage awaits params concurrently while getCurrentProfile is pending', async () => {
  let resolveProfile!: (value: unknown) => void
  const profilePromise = new Promise(resolve => {
    resolveProfile = resolve
  })

  currentProfileHandler = () => profilePromise

  let paramsAwaited = false
  const params = {
    then(onFulfilled: (val: unknown) => unknown, onRejected: (err: unknown) => unknown) {
      paramsAwaited = true
      return Promise.resolve({ id: 'item-888' }).then(onFulfilled, onRejected)
    },
  }

  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')
  const pending = ItemDetailPage({ params: params as unknown as Promise<{ id: string }> })

  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(
      paramsAwaited,
      true,
      'params should be awaited concurrently while getCurrentProfile is still pending'
    )
  } finally {
    resolveProfile({ id: 'user-staff', role: 'staff', is_active: true })
    const element = await pending
    assert.ok(element, 'ItemDetailPage should render successfully')
  }
})
