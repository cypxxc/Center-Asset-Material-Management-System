import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { getAuditLogsList } from '../../features/admin/queries';

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-for-test';

test('getAuditLogsList filters by action (e.g. INSERT, UPDATE, DELETE, EXPORT_REPORT)', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  const mockLogs = [
    {
      id: 'log-1',
      user_id: 'user-admin',
      action: 'INSERT',
      target_table: 'items',
      target_id: 'item-uuid-1',
      old_data: null,
      new_data: { item_name: 'Laptop Dell' },
      created_at: '2026-08-14T10:00:00Z',
      profiles: { id: 'user-admin', full_name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    },
  ];
  mockSupabaseRegistry.setTableResponse('audit_logs', mockLogs);

  const result = await getAuditLogsList({ action: 'INSERT' });

  assert.equal(result.error, undefined);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].action, 'INSERT');
  assert.equal(result.logs[0].actor_name, 'Admin User');

  const queryLog = mockSupabaseRegistry.getQueryLog();
  const auditQuery = queryLog.find((q) => q.table === 'audit_logs');
  assert.ok(auditQuery, 'Expected query to audit_logs');
  const hasActionFilter = auditQuery.operations.some(
    (op) => op[0] === 'eq' && op[1] === 'action' && op[2] === 'INSERT'
  );
  assert.ok(hasActionFilter, 'Expected eq filter on action=INSERT');
});

test('getAuditLogsList matches search strings on target_id or target_table', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  mockSupabaseRegistry.setTableResponse('audit_logs', [
    {
      id: 'log-2',
      user_id: 'user-admin',
      action: 'UPDATE',
      target_table: 'locations',
      target_id: '12345678-1234-1234-1234-123456789abc',
      old_data: { name: 'Room 101' },
      new_data: { name: 'Room 102' },
      created_at: '2026-08-14T11:00:00Z',
      profiles: { id: 'user-admin', full_name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    },
  ]);

  const resultText = await getAuditLogsList({ q: 'locations' });
  assert.equal(resultText.error, undefined);
  assert.equal(resultText.logs.length, 1);

  const queryLog1 = mockSupabaseRegistry.getQueryLog();
  const textQuery = queryLog1.find((q) => q.table === 'audit_logs');
  assert.ok(textQuery);
  assert.ok(textQuery.operations.some((op) => op[0] === 'or' && String(op[1]).includes('locations')));

  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );
  mockSupabaseRegistry.setTableResponse('audit_logs', [
    {
      id: 'log-2',
      user_id: 'user-admin',
      action: 'UPDATE',
      target_table: 'locations',
      target_id: '12345678-1234-1234-1234-123456789abc',
      old_data: { name: 'Room 101' },
      new_data: { name: 'Room 102' },
      created_at: '2026-08-14T11:00:00Z',
      profiles: { id: 'user-admin', full_name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    },
  ]);

  const resultUuid = await getAuditLogsList({ q: '12345678-1234-1234-1234-123456789abc' });
  assert.equal(resultUuid.error, undefined);
  const queryLog2 = mockSupabaseRegistry.getQueryLog();
  const uuidQuery = queryLog2.find((q) => q.table === 'audit_logs');
  assert.ok(uuidQuery);
  assert.ok(uuidQuery.operations.some((op) => op[0] === 'or' && String(op[1]).includes('target_id.eq')));
});

test('getAuditLogsList filters by target_table and pagination', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-admin', email: 'admin@example.com' },
    { id: 'user-admin', email: 'admin@example.com', role: 'admin', is_active: true }
  );
  mockSupabaseRegistry.setTableResponse('audit_logs', []);

  const result = await getAuditLogsList({ target_table: 'items', page: 2, pageSize: 25 });
  assert.equal(result.error, undefined);

  const queryLog = mockSupabaseRegistry.getQueryLog();
  const auditQuery = queryLog.find((q) => q.table === 'audit_logs');
  assert.ok(auditQuery);
  assert.ok(auditQuery.operations.some((op) => op[0] === 'eq' && op[1] === 'target_table' && op[2] === 'items'));
  assert.ok(auditQuery.operations.some((op) => op[0] === 'range' && op[1] === 25 && op[2] === 49));
});

test('getAuditLogsList rejects non-admin access safely', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const result = await getAuditLogsList({ page: 1, pageSize: 50 });

  assert.ok(result.error);
  assert.match(result.error, /Admin role required/i);
  assert.deepEqual(result.logs, []);
  assert.equal(result.totalCount, 0);
});

test('getAuditLogsList handles unauthenticated access safely', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(null, null);

  const result = await getAuditLogsList();

  assert.ok(result.error);
  assert.match(result.error, /Admin role required/i);
  assert.deepEqual(result.logs, []);
  assert.equal(result.totalCount, 0);
});
