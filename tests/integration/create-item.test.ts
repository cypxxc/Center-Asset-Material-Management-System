import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { createItem } from '../../features/items/actions';

test('createItem rejects unauthenticated requests', async () => {
  mockSupabaseRegistry.clear();
  
  const formData = new FormData();
  const res = await createItem(null, formData);
  assert.equal(res.success, undefined);
  assert.equal(res.message, 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
});

test('createItem rejects unauthorized viewer requests', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer', email: 'viewer@example.com' },
    { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
  );

  const formData = new FormData();
  const res = await createItem(null, formData);
  assert.equal(res.message, 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ');
});

test('createItem rejects invalid inputs with validation messages', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const formData = new FormData();
  formData.set('item_name', ''); // missing name
  formData.set('item_type', 'asset');
  
  const res = await createItem(null, formData);
  assert.equal(res.message, 'กรุณาตรวจสอบข้อมูลในฟอร์ม');
  assert.ok(res.fieldErrors?.item_name);
});

test('createItem redirects to /items upon successful creation', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  // Set mock responses
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'new-item-uuid' }]);
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-id' }]);

  const formData = new FormData();
  formData.set('item_name', 'Office Chair');
  formData.set('item_type', 'asset');
  formData.set('quantity', '1');
  formData.set('status', 'active');
  
  // Set empty strings for optional fields to satisfy Zod schema preprocessors
  formData.set('category_id', '');
  formData.set('unit_id', '');
  formData.set('asset_no', '');
  formData.set('serial_no', '');
  formData.set('brand', '');
  formData.set('model', '');
  formData.set('location_id', '');
  formData.set('responsible_person', '');
  formData.set('note', '');
  formData.set('image_url', '');

  try {
    await createItem(null, formData);
    assert.fail('Should have redirected');
  } catch (err: any) {
    if (err.message === 'NEXT_REDIRECT') {
      assert.ok(err.digest.includes('/items'));
    } else {
      throw err;
    }
  }
});
