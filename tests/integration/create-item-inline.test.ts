import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { createItemInline } from '../../features/items/actions'

test('creation wrappers share one private creation core', () => {
  const source = readFileSync(require.resolve('../../features/items/actions'), 'utf8')
  assert.match(source, /async function createItemCore\(/)
  assert.doesNotMatch(source, /export\s+(?:async\s+)?function createItemCore/)
  assert.equal(source.match(/await createItemCore\(formData/g)?.length, 2)
  assert.equal(source.match(/\.from\('items'\)\s*\r?\n\s*\.insert\(/g)?.length, 1)
})

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

test('createItemInline ignores obsolete template fields and keeps the manual number', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'staff' }, { id: 'staff', role: 'staff', is_active: true })
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'new-item' }])
  const form = validItemFormData()
  form.set('asset_number_mode', 'template')
  form.set('asset_number_template_id', 'obsolete-template')
  form.set('asset_number_payload', 'invalid-json')
  let inserted: Record<string, unknown> | undefined
  const original = mockSupabaseRegistry.recordQuery
  mockSupabaseRegistry.recordQuery = (entry) => {
    original.call(mockSupabaseRegistry, entry)
    if (entry.table === 'items') inserted = entry.operations.find(([operation]) => operation === 'insert')?.[1] as Record<string, unknown>
  }
  try {
    const result = await createItemInline(null, form)
    assert.equal(result.success, true)
    assert.equal(inserted?.asset_no, 'ASSET-001')
    assert.equal(inserted?.asset_number_source, 'manual')
    assert.equal(inserted?.asset_number_template_id, null)
  } finally {
    mockSupabaseRegistry.recordQuery = original
  }
})

test('createItemInline uses ActionResponse for unauthenticated and viewer requests', async () => {
  const warnCalls: unknown[][] = []
  const originalConsoleWarn = console.warn
  console.warn = (...args: unknown[]) => warnCalls.push(args)
  try {
    mockSupabaseRegistry.clear()
    assert.deepEqual(await createItemInline(null, validItemFormData()), {
      success: false, ok: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', fieldErrors: undefined,
    })

    mockSupabaseRegistry.clear()
    mockSupabaseRegistry.setAuth({ id: 'viewer' }, { id: 'viewer', role: 'viewer', is_active: true })
    assert.deepEqual(await createItemInline(null, validItemFormData()), {
      success: false, ok: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', fieldErrors: undefined,
    })
    assert.equal(warnCalls.length, 2)
    for (const call of warnCalls) {
      const log = JSON.parse(String(call[1])) as Record<string, unknown>
      assert.equal(log.operation, 'createItemInline')
      assert.equal(log.details, 'Unauthorized inline create attempt')
    }
  } finally {
    console.warn = originalConsoleWarn
  }
})

test('createItemInline returns the friendly uniqueness message as ActionResponse', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'staff' }, { id: 'staff', role: 'staff', is_active: true })
  mockSupabaseRegistry.setTableResponse('items', null, { message: 'unique_asset_no_not_deleted' })
  assert.deepEqual(await createItemInline(null, validItemFormData()), {
    success: false, ok: false, message: 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว', error: 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว', fieldErrors: undefined,
  })
})

test('createItemInline succeeds without throwing NEXT_REDIRECT', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'staff' }, { id: 'staff', role: 'staff', is_active: true })
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'new-item' }])
  const infoCalls: unknown[][] = []
  const originalConsoleInfo = console.info
  console.info = (...args: unknown[]) => infoCalls.push(args)
  try {
    const result = await createItemInline(null, validItemFormData())
    assert.deepEqual(result, { success: true, ok: true, message: 'สร้างพัสดุสำเร็จ', data: undefined })
    const log = JSON.parse(String(infoCalls.at(-1)?.[1])) as Record<string, unknown>
    assert.equal(log.operation, 'createItemInline')
    assert.equal(log.userId, 'staff')
    assert.deepEqual(log.details, { id: 'new-item' })
  } finally {
    console.info = originalConsoleInfo
  }
})

test('createItemInline returns its generic unexpected response and redacts insert secrets', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'staff' }, { id: 'staff', role: 'staff', is_active: true })
  const secret = 'sbp_1234567890abcdef1234567890abcdef'
  const errorCalls: unknown[][] = []
  const originalConsoleError = console.error
  const originalRecordQuery = mockSupabaseRegistry.recordQuery
  console.error = (...args: unknown[]) => errorCalls.push(args)
  mockSupabaseRegistry.recordQuery = (entry) => {
    originalRecordQuery.call(mockSupabaseRegistry, entry)
    if (entry.table === 'items') throw new Error(`inline insert exploded: ${secret}`)
  }
  try {
    assert.deepEqual(await createItemInline(null, validItemFormData()), {
      success: false,
      ok: false,
      message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายหรือเข้าถึงฐานข้อมูล',
      error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายหรือเข้าถึงฐานข้อมูล',
      fieldErrors: undefined,
    })
    const output = errorCalls.flat().map(String).join(' ')
    assert.match(output, /"operation":"createItemInline"/)
    assert.match(output, /\[KEY_REDACTED\]/)
    assert.equal(output.includes(secret), false)
  } finally {
    console.error = originalConsoleError
    mockSupabaseRegistry.recordQuery = originalRecordQuery
  }
})
