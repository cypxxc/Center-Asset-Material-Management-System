import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { createCategory, deleteLocation, updateCategory } from '../../features/settings/actions';
import { getSettingsData } from '../../features/settings/queries';

function isRedirectError(err: unknown): err is Error & { digest: string } {
  return err instanceof Error && typeof (err as { digest?: unknown }).digest === 'string';
}

test('createCategory redirects with error when user has viewer role', async () => {
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
  } catch (err: unknown) {
    if (isRedirectError(err) && err.message === 'NEXT_REDIRECT') {
      assert.ok(decodeURIComponent(err.digest).includes('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้'));
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
  } catch (err: unknown) {
    if (isRedirectError(err) && err.message === 'NEXT_REDIRECT') {
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
  } catch (err: unknown) {
    if (isRedirectError(err) && err.message === 'NEXT_REDIRECT') {
      assert.ok(decodeURIComponent(err.digest).includes('อัปเดตหมวดหมู่สำเร็จ'));
    } else {
      throw err;
    }
  }
});

test('deleteLocation blocks deletion when any item still references the location', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('items', [
    { id: 'item-uuid', location_id: 'location-uuid', deleted_at: '2026-07-03T00:00:00.000Z' },
  ]);

  try {
    await deleteLocation('location-uuid');
    assert.fail('Should have redirected');
  } catch (err: unknown) {
    if (isRedirectError(err) && err.message === 'NEXT_REDIRECT') {
      const decodedDigest = decodeURIComponent(err.digest);
      assert.ok(decodedDigest.includes('ไม่สามารถลบข้อมูลนี้ได้เนื่องจากกำลังถูกใช้งานโดยพัสดุในระบบ'));
      assert.ok(decodedDigest.includes('tab=locations'));
    } else {
      throw err;
    }
  }
});

test('getSettingsData can fetch only the active metadata section', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setTableResponse('categories', [{ id: 'cat-1', name: 'IT' }]);
  mockSupabaseRegistry.setTableResponse('locations', [{ id: 'loc-1', name: 'HQ' }]);
  mockSupabaseRegistry.setTableResponse('units', [{ id: 'unit-1', name: 'pcs' }]);

  const data = await getSettingsData('categories');

  assert.equal(data.categories.length, 1);
  assert.equal(data.locations.length, 0);
  assert.equal(data.units.length, 0);
  assert.deepEqual(
    mockSupabaseRegistry.getQueryLog().map((entry) => entry.table),
    ['categories']
  );
});
