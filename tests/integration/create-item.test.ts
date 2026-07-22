import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createMockSupabaseClient, mockSupabaseRegistry } from '../mocks/supabase'

type InsertObservation = { table: string; values: unknown }
const inserts: InsertObservation[] = []
const cacheCalls: unknown[][] = []
const rateLimitCalls: unknown[][] = []

function observedClient(kind: 'anon' | 'service') {
  const client = createMockSupabaseClient(kind)
  return {
    ...client,
    from(table: string) {
      const builder = client.from(table)
      const originalInsert = builder.insert.bind(builder)
      builder.insert = (values: unknown) => {
        inserts.push({ table, values })
        return originalInsert(values)
      }
      return builder
    },
  }
}

const serverPath = require.resolve('../../lib/supabase/server')
Object.assign(require.cache[serverPath]!.exports, {
  createClient: async () => observedClient('anon'),
  createAdminClient: async () => observedClient('service'),
  createServiceRoleClient: () => observedClient('service'),
})

const cachePath = require.resolve('next/cache')
Object.assign(require.cache[cachePath]!.exports, {
  revalidatePath: (...args: unknown[]) => cacheCalls.push(['path', ...args]),
  revalidateTag: (...args: unknown[]) => cacheCalls.push(['tag', ...args]),
})

const rateLimitPath = require.resolve('../../lib/rate-limit')
const realRateLimit = require(rateLimitPath)
require.cache[rateLimitPath]!.exports = {
  ...realRateLimit,
  checkRateLimit: async (...args: unknown[]) => {
    rateLimitCalls.push(args)
    return { success: true }
  },
}

const { createItem, createItemInline } = require('../../features/items/actions') as typeof import('../../features/items/actions')

function validItemFormData(withImage = false) {
  const formData = new FormData()
  const values: Record<string, string> = {
    item_name: 'Office Chair',
    item_type: 'asset',
    category_id: '',
    quantity: '2',
    unit_price: '1250.50',
    unit_id: '',
    asset_no: 'ASSET-001',
    serial_no: 'SERIAL-001',
    brand: 'Registry',
    model: 'S1',
    location_id: '',
    responsible_person: 'Somchai',
    status: 'active',
    note: 'Characterization fixture',
    image_url: '',
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  if (withImage) formData.set('image_file', new File(['image-bytes'], 'item.jpg', { type: 'image/jpeg' }))
  return formData
}

function staff() {
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true },
  )
}

function reset() {
  mockSupabaseRegistry.clear()
  inserts.length = 0
  cacheCalls.length = 0
  rateLimitCalls.length = 0
}

test('createItem returns its legacy unauthenticated and viewer response shapes', async () => {
  reset()
  assert.deepEqual(await createItem(null, validItemFormData()), { message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' })

  reset()
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer' },
    { id: 'user-viewer', role: 'viewer', is_active: true },
  )
  assert.deepEqual(await createItem(null, validItemFormData()), { message: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ' })
})

test('both creation actions return identical field errors for invalid input', async () => {
  reset()
  staff()
  const classic = await createItem(null, new FormData())
  const inline = await createItemInline(null, new FormData())
  assert.deepEqual(classic.fieldErrors, inline.fieldErrors)
  assert.ok(classic.fieldErrors?.item_name)
  assert.equal(classic.message, 'กรุณาตรวจสอบข้อมูลในฟอร์ม')
})

test('createItem inserts attribution, writes the creation audit, refreshes caches, and redirects', async () => {
  reset()
  staff()
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'new-item-uuid' }])
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-id' }])
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  try {
    await assert.rejects(
      createItem(null, validItemFormData()),
      (error: Error & { digest?: string }) => error.message === 'NEXT_REDIRECT' && Boolean(error.digest?.includes('/items')),
    )
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey
  }

  const itemInsert = inserts.find((entry) => entry.table === 'items')!.values as Record<string, unknown>
  assert.equal(itemInsert.created_by, 'user-staff')
  assert.equal(itemInsert.updated_by, 'user-staff')
  const auditInsert = inserts.find((entry) => entry.table === 'audit_logs')!.values as Record<string, unknown>
  assert.deepEqual(
    { action: auditInsert.action, target_table: auditInsert.target_table, target_id: auditInsert.target_id },
    { action: 'create', target_table: 'items', target_id: 'new-item-uuid' },
  )
  assert.deepEqual(cacheCalls, [
    ['path', '/items'],
    ['tag', 'sidebar-data', 'max'],
    ['path', '/', 'layout'],
  ])
})

test('both actions create the same item audit payload', async () => {
  async function auditFor(action: typeof createItem | typeof createItemInline) {
    reset()
    staff()
    mockSupabaseRegistry.setTableResponse('items', [{ id: 'new-item-uuid' }])
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    try {
      await action(null, validItemFormData()).catch((error: Error) => {
        if (error.message !== 'NEXT_REDIRECT') throw error
      })
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey
    }
    const item = inserts.find((entry) => entry.table === 'items')!.values as Record<string, unknown>
    assert.equal(item.created_by, 'user-staff')
    assert.equal(item.updated_by, 'user-staff')
    const audit = inserts.find((entry) => entry.table === 'audit_logs')!.values as Record<string, unknown>
    return { action: audit.action, target_table: audit.target_table, target_id: audit.target_id, values: (audit.new_data as { values: unknown }).values }
  }
  assert.deepEqual(await auditFor(createItem), await auditFor(createItemInline))
})

test('both actions remove an uploaded image exactly once when item insertion fails', async () => {
  for (const action of [createItem, createItemInline]) {
    reset()
    staff()
    mockSupabaseRegistry.setTableResponse('items', null, { message: 'database unavailable' })
    const result = await action(null, validItemFormData(true))
    assert.equal(result.success, action === createItem ? undefined : false)
    assert.equal(mockSupabaseRegistry.getStorageLog().filter((entry) => entry.operation === 'remove').length, 1)
    assert.deepEqual(cacheCalls, [])
  }
})

test('only createItem applies the existing create rate limit contract', async () => {
  reset()
  staff()
  await createItem(null, new FormData())
  await createItemInline(null, new FormData())
  assert.deepEqual(rateLimitCalls, [['createItem', 30, 60000]])
})
