import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { createCategory, updateCategory } from '../../features/settings/actions';

test('createCategory redirects with error when user has viewer role (not admin or staff)', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer', email: 'viewer@example.com' },
    { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
  );

  const formData = new FormData();
  formData.set('name', 'New Category');
  formData.set('description', '');

  try {
    await createCategory(formData);
    assert.fail('Should have redirected');
  } catch (err: any) {
    if (err.message === 'NEXT_REDIRECT') {
      assert.ok(decodeURIComponent(err.digest).includes('คุณไม่มีสิทธิ์จัดการข้อมูลตั้งค่าระบบ'));
    } else {
      throw err;
    }
  }
});

test('createCategory creates category and redirects with success message for admin', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('categories', [{ id: 'cat-uuid', name: 'IT Gadgets' }]);

  const formData = new FormData();
  formData.set('name', 'IT Gadgets');
  formData.set('description', '');

  try {
    await createCategory(formData);
    assert.fail('Should have redirected');
  } catch (err: any) {
    if (err.message === 'NEXT_REDIRECT') {
      assert.ok(decodeURIComponent(err.digest).includes('สร้างหมวดหมู่สำเร็จ'));
    } else {
      throw err;
    }
  }
});

test('updateCategory updates category name and redirects with success message', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('categories', [{ id: 'cat-uuid', name: 'IT Devices' }]);

  const formData = new FormData();
  formData.set('name', 'IT Devices');
  formData.set('description', '');
  formData.set('is_active', 'on');

  try {
    await updateCategory('cat-uuid', formData);
    assert.fail('Should have redirected');
  } catch (err: any) {
    if (err.message === 'NEXT_REDIRECT') {
      assert.ok(decodeURIComponent(err.digest).includes('อัปเดตหมวดหมู่สำเร็จ'));
    } else {
      throw err;
    }
  }
});
