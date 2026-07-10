import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { exportDatabaseData } from '../../features/admin/actions';

test('exportDatabaseData reads backup tables concurrently', async () => {
  mockSupabaseRegistry.clear();
  const tables = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs'];
  for (const table of tables) {
    mockSupabaseRegistry.setTableResponse(table, [{ id: `${table}-1` }]);
    mockSupabaseRegistry.setTableDelay(table, 60);
  }
  mockSupabaseRegistry.setAuth(
    { id: 'admin-user', email: 'admin@example.com' },
    { id: 'admin-user', email: 'admin@example.com', role: 'admin', is_active: true }
  );

  const start = performance.now();
  const result = await exportDatabaseData();
  const elapsedMs = performance.now() - start;

  assert.equal(result.error, undefined);
  assert.equal(result.backup?.items?.[0]?.id, 'items-1');
  assert.ok(elapsedMs < 300, `expected parallel backup below 300ms, got ${elapsedMs}`);
});
