import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { createItemInline } from '../../features/items/actions'

function validItemFormData() {
  const formData = new FormData()
  for (const [key, value] of Object.entries({
    item_name: 'Office Chair', item_type: 'asset', category_id: '', quantity: '1', unit_price: '',
    unit_id: '', asset_no: '', serial_no: '', brand: '', model: '', location_id: '',
    responsible_person: '', status: 'active', note: '', image_url: '',
  })) formData.set(key, value)
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
