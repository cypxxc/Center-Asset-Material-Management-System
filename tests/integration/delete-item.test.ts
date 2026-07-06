import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { softDeleteItem } from '../../features/items/actions';

test('softDeleteItem rejects viewer role with error message', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer', email: 'viewer@example.com' },
    { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
  );

  const res = await softDeleteItem('item-id');
  assert.equal(res.success, undefined);
  assert.equal(res.message, 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้');
});

test('softDeleteItem redirects to /items upon successful soft deletion for staff', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('items', [{ id: 'item-uuid', item_name: 'Laptop', asset_no: '', serial_no: '' }]);
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-id' }]);

  try {
    await softDeleteItem('item-uuid');
    assert.fail('Should have redirected');
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      assert.ok('digest' in err && String(err.digest).includes('/items'));
    } else {
      throw err;
    }
  }
});

test('softDeleteItem redirects to /items upon successful soft deletion for admin', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('items', [{ id: 'item-uuid', item_name: 'Laptop', asset_no: '', serial_no: '' }]);
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-id' }]);

  try {
    await softDeleteItem('item-uuid');
    assert.fail('Should have redirected');
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      assert.ok('digest' in err && String(err.digest).includes('/items'));
    } else {
      throw err;
    }
  }
});
