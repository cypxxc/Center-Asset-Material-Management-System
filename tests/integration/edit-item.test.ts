import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { updateItem } from '../../features/items/actions';

test('updateItem rejects viewer role', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer', email: 'viewer@example.com' },
    { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
  );

  const formData = new FormData();
  const res = await updateItem('item-id', null, formData);
  assert.equal(res.message, 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ');
});

test('updateItem redirects to item details page upon success', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  // Set mock responses
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'item-uuid', item_name: 'Old Name', image_url: null }]);
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-id' }]);

  const formData = new FormData();
  formData.set('item_name', 'New Office Desk');
  formData.set('item_type', 'asset');
  formData.set('quantity', '2');
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
    await updateItem('item-uuid', null, formData);
    assert.fail('Should have redirected');
  } catch (err: any) {
    if (err.message === 'NEXT_REDIRECT') {
      assert.ok(err.digest.includes('/items/item-uuid'));
    } else {
      throw err;
    }
  }
});
