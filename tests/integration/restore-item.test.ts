import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { restoreItem } from '../../features/items/actions';

test('restoreItem rejects viewer role', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-viewer', email: 'viewer@example.com' },
    { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
  );

  const res = await restoreItem('item-id');
  assert.equal(res.ok, false);
  assert.equal(res.message, 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ');
});

test('restoreItem succeeds for staff member', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('items', [{ id: 'item-uuid' }]);
  mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-id' }]);

  const res = await restoreItem('item-uuid');
  assert.equal(res.success, true);
  assert.ok(res.message?.includes('กู้คืนรายการเรียบร้อย'));
});
