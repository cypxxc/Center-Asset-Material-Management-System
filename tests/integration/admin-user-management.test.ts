import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { updateUserEmail } from '../../features/admin/actions';

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-for-test';

test('updateUserEmail rejects non-admin role', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await updateUserEmail('user-123', 'new-email@example.com');
  assert.ok(res.error);
  assert.match(res.error, /Admin role required/i);
});

test('updateUserEmail rejects invalid email format for admin', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  const res = await updateUserEmail('user-123', 'invalid-email-format');
  assert.ok(res.error);
  assert.equal(res.error, 'กรุณาระบุรูปแบบอีเมลให้ถูกต้อง');
});

test('updateUserEmail syncs Supabase Auth and profiles for admin', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  const res = await updateUserEmail('user-123', 'New-Email@Example.com');

  assert.equal(res.success, true);
  assert.deepEqual(mockSupabaseRegistry.getAuthAdminLog(), [
    {
      operation: 'updateUserById',
      userId: 'user-123',
      payload: { email: 'new-email@example.com', email_confirm: true },
    },
  ]);

  const profileUpdate = mockSupabaseRegistry
    .getQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations[0]?.[0] === 'update');
  assert.ok(profileUpdate);
  const profileUpdatePayload = profileUpdate.operations[0]?.[1] as Record<string, unknown>;
  assert.equal(profileUpdatePayload.email, 'new-email@example.com');
  assert.match(String(profileUpdatePayload.updated_at), /^\d{4}-\d{2}-\d{2}T/);
});
