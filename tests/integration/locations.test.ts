import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { getItemReferences, getItemById, getItemAuditLogs, clearReferencesCache } from '../../features/items/queries';

test('getItemReferences fetches categories, locations and units concurrently', async () => {
  mockSupabaseRegistry.clear();

  mockSupabaseRegistry.setTableResponse('categories', [{ id: 'cat-1', name: 'Electronics' }]);
  mockSupabaseRegistry.setTableResponse('locations', [{ id: 'loc-1', name: 'Building A' }]);
  mockSupabaseRegistry.setTableResponse('units', [{ id: 'unit-1', name: 'PCs' }]);

  const refs = await getItemReferences();
  assert.equal(refs.categories.length, 1);
  assert.equal(refs.categories[0].name, 'Electronics');
  assert.equal(refs.locations.length, 1);
  assert.equal(refs.locations[0].name, 'Building A');
  assert.equal(refs.units.length, 1);
  assert.equal(refs.units[0].name, 'PCs');
});

test('getItemById fetches a single item detail from mock store', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setTableResponse('items', [
    { id: 'item-1', item_name: 'Dell Monitor', item_type: 'asset', quantity: 2, status: 'active' }
  ]);

  const item = await getItemById('item-1');
  assert.ok(item);
  assert.equal(item.item_name, 'Dell Monitor');
});

test('clearReferencesCache runs successfully without throwing', () => {
  assert.doesNotThrow(() => {
    clearReferencesCache();
  });
});

test('getItemAuditLogs preserves full audit timeline query for admins', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'admin-user', email: 'admin@example.com' },
    { id: 'admin-user', email: 'admin@example.com', role: 'admin', is_active: true }
  );
  mockSupabaseRegistry.setTableResponse('audit_logs', []);

  await getItemAuditLogs('item-1');

  const auditLogQuery = mockSupabaseRegistry
    .getQueryLog()
    .find((entry) => entry.table === 'audit_logs');
  assert.ok(auditLogQuery);
  assert.deepEqual(auditLogQuery.operations, [
    ['select'],
    ['eq', 'target_table', 'items'],
    ['eq', 'target_id', 'item-1'],
    ['order', 'created_at'],
  ]);
});
