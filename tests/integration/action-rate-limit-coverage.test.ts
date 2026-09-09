import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const deniedMessage = 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'
let active = true
const buckets: string[] = []
let effects = 0

function replaceModule(name: string, exports: unknown) {
  const filename = require.resolve(name)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

replaceModule('../../features/auth/queries', {
  getCurrentProfile: async () => ({ id: 'admin-1', role: 'admin', is_active: active }),
})
replaceModule('../../lib/rate-limit', {
  checkRateLimit: async (bucket: string) => {
    buckets.push(bucket)
    return { success: false, error: deniedMessage }
  },
})
replaceModule('../../lib/supabase/server', {
  createClient: async () => { effects++; throw new Error('Unexpected database access') },
  createServiceRoleClient: () => { effects++; throw new Error('Unexpected privileged access') },
})
replaceModule('../../features/reports/queries', {
  getReportItemsList: async () => { effects++; return { items: [] } },
  getExportReportItems: async () => { effects++; return { items: [], totalCount: 0, totalQuantity: 0, totalValue: 0 } },
})
replaceModule('../../lib/audit', {
  writeAuditLog: async () => { effects++ },
})

// Load actions only after replacing their security boundaries.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const items = require('../../features/items/actions') as typeof import('../../features/items/actions')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const reports = require('../../features/reports/actions') as typeof import('../../features/reports/actions')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const settings = require('../../features/settings/actions') as typeof import('../../features/settings/actions')

beforeEach(() => { active = true; buckets.length = 0; effects = 0 })

const mutations = [
  ['createItem', () => items.createItem(null, new FormData())],
  ['createItem', () => items.createItemInline(null, new FormData())],
  ['bulkUpdateItems', () => items.bulkUpdateItems(['id'], { status: 'active' })],
  ['bulkDeleteItems', () => items.bulkDeleteItems(['id'])],
  ['hardDeleteItem', () => items.hardDeleteItem('id')],
  ['bulkHardDeleteItems', () => items.bulkHardDeleteItems(['id'])],
] as const

for (const [index, [bucket, invoke]] of mutations.entries()) {
  test(`mutation ${index} denies before writes and consumes ${bucket}`, async () => {
    const result = await invoke()
    assert.equal(result.message, deniedMessage)
    assert.deepEqual(buckets, [bucket])
    assert.equal(effects, 0)
  })
  test(`mutation ${index} rejects inactive users before the limiter`, async () => {
    active = false
    const result = await invoke()
    assert.ok(result.message)
    assert.deepEqual(buckets, [])
    assert.equal(effects, 0)
  })
}

for (const [bucket, invoke] of [
  ['getItemsForExport', () => items.getItemsForExport({})],
  ['getExportReportItems', () => reports.getExportReportItems({})],
] as const) {
  test(`${bucket} blocks export queries when limited`, async () => {
    await assert.rejects(invoke, { message: deniedMessage })
    assert.deepEqual(buckets, [bucket])
    assert.equal(effects, 0)
  })
  test(`${bucket} blocks inactive users before queries`, async () => {
    active = false
    await assert.rejects(invoke)
    assert.deepEqual(buckets, [])
    assert.equal(effects, 0)
  })
}

test('report audit is rate limited before persistence', async () => {
  const result = await reports.recordReportExportAudit('excel', 'all')
  assert.equal(result.message, deniedMessage)
  assert.deepEqual(buckets, ['recordReportExportAudit'])
  assert.equal(effects, 0)
})

test('profile update redirects with actionable error before persistence', async () => {
  const form = new FormData()
  form.set('role', 'staff')
  await assert.rejects(() => settings.updateProfile('other-user', form), (error: unknown) => {
    assert.ok(decodeURIComponent((error as { digest: string }).digest).includes(deniedMessage))
    return true
  })
  assert.deepEqual(buckets, ['updateProfile'])
  assert.equal(effects, 0)
})
