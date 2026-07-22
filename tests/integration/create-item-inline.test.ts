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

test('createItemInline uses ActionResponse for unauthenticated and viewer requests', async () => {
  mockSupabaseRegistry.clear()
  assert.deepEqual(await createItemInline(null, validItemFormData()), {
    success: false, ok: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', fieldErrors: undefined,
  })

  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'viewer' }, { id: 'viewer', role: 'viewer', is_active: true })
  assert.deepEqual(await createItemInline(null, validItemFormData()), {
    success: false, ok: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', fieldErrors: undefined,
  })
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
  const result = await createItemInline(null, validItemFormData())
  assert.deepEqual(result, { success: true, ok: true, message: 'สร้างพัสดุสำเร็จ', data: undefined })
})
