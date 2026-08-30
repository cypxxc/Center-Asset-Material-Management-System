import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { getProfilesList } from '../../features/admin/queries';
import { updateUserProfileRoleAndStatus } from '../../features/admin/actions';

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-for-test';

test('getProfilesList queries profiles with search term, role filter, and pagination', async () => {
  mockSupabaseRegistry.clear();
  const mockProfiles = [
    {
      id: 'user-1',
      full_name: 'Somchai Prasert',
      email: 'somchai@example.com',
      role: 'staff',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'user-2',
      full_name: 'Somsak Jaidee',
      email: 'somsak@example.com',
      role: 'viewer',
      is_active: false,
      created_at: '2026-08-03T00:00:00Z',
      updated_at: null,
    },
  ];
  mockSupabaseRegistry.setTableResponse('profiles', mockProfiles);

  const res = await getProfilesList({ q: 'Somchai', role: 'staff', is_active: 'true', page: 1, pageSize: 10 });

  assert.equal(res.profiles.length, 2);
  assert.equal(res.totalCount, 2);

  const queryLog = mockSupabaseRegistry.getQueryLog();
  const profilesQuery = queryLog.find((q) => q.table === 'profiles');
  assert.ok(profilesQuery, 'Profiles query should be logged');

  const operations = profilesQuery.operations.map((op) => op[0]);
  assert.ok(operations.includes('select'), 'Should include select operation');
  assert.ok(operations.includes('order'), 'Should include order operation');
  assert.ok(operations.includes('or'), 'Should include or filter for search term');
  assert.ok(operations.includes('eq'), 'Should include eq filter for role/active status');
  assert.ok(operations.includes('range'), 'Should include range pagination');
});

test('updateUserProfileRoleAndStatus rejects non-admin users', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await updateUserProfileRoleAndStatus('user-target', { role: 'admin', is_active: true });
  assert.ok(res.error);
  assert.match(res.error, /Admin role required/i);
});

test('updateUserProfileRoleAndStatus rejects inactive admin', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin-inactive', email: 'admin@example.com' },
    { id: 'user-admin-inactive', email: 'admin@example.com', role: 'admin', is_active: false }
  );

  const res = await updateUserProfileRoleAndStatus('user-target', { role: 'staff' });
  assert.ok(res.error);
  assert.match(res.error, /profile must be active/i);
});

test('updateUserProfileRoleAndStatus updates profile and records audit log for admin', async () => {
  mockSupabaseRegistry.clear();
  const adminProfile = { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true };
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    adminProfile
  );

  const res = await updateUserProfileRoleAndStatus('user-target', {
    role: 'staff',
    is_active: false,
    full_name: 'Updated Target User',
  });

  assert.equal(res.success, true);

  const queryLog = mockSupabaseRegistry.getQueryLog();
  const profileUpdate = queryLog.find((entry) => entry.table === 'profiles' && entry.operations.some((op) => op[0] === 'update'));
  assert.ok(profileUpdate, 'Profile update should be logged');

  const updateOp = profileUpdate.operations.find((op) => op[0] === 'update');
  assert.ok(updateOp);
  const updatePayload = updateOp[1] as Record<string, unknown>;
  assert.equal(updatePayload.role, 'staff');
  assert.equal(updatePayload.is_active, false);
  assert.equal(updatePayload.full_name, 'Updated Target User');
  assert.ok(updatePayload.updated_at);

  const auditInsert = queryLog.find((entry) => entry.table === 'audit_logs' && entry.operations.some((op) => op[0] === 'insert'));
  assert.ok(auditInsert, 'Audit log insert should be recorded');
  const insertOp = auditInsert.operations.find((op) => op[0] === 'insert');
  const auditPayload = insertOp?.[1] as Record<string, unknown>;
  assert.equal(auditPayload.action, 'UPDATE_PROFILE');
  assert.equal(auditPayload.target_table, 'profiles');
  assert.equal(auditPayload.target_id, 'user-target');
});

test('updateUserProfileRoleAndStatus prevents self-deactivation and self-demotion', async () => {
  mockSupabaseRegistry.clear();
  const adminProfile = { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true };
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    adminProfile
  );

  // Self deactivation
  const resDeactivate = await updateUserProfileRoleAndStatus('user-admin', { is_active: false });
  assert.ok(resDeactivate.error);
  assert.match(resDeactivate.error, /ไม่สามารถปิดการใช้งานบัญชีของตนเองได้/);

  // Self demotion
  const resDemote = await updateUserProfileRoleAndStatus('user-admin', { role: 'staff' });
  assert.ok(resDemote.error);
  assert.match(resDemote.error, /ไม่สามารถเปลี่ยนบทบาทของตนเองได้/);
});

test('updateUserProfileRoleAndStatus rejects invalid role', async () => {
  mockSupabaseRegistry.clear();
  const adminProfile = { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true };
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    adminProfile
  );

  // @ts-expect-error testing invalid role
  const res = await updateUserProfileRoleAndStatus('user-target', { role: 'superadmin' });
  assert.ok(res.error);
  assert.match(res.error, /บทบาทไม่ถูกต้อง/);
});

