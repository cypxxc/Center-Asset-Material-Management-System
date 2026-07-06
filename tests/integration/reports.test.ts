import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { getReportItemsList, getReportStats } from '../../features/reports/queries';
import { getReportItemsForExport } from '../../features/reports/actions';

test('getReportStats queries get_report_stats RPC and formats counts', async () => {
  mockSupabaseRegistry.clear();
  
  mockSupabaseRegistry.setRpcResponse('get_report_stats', {
    total_items: 10,
    total_quantity: 12,
    type_counts: {
      asset: { count: 6, qty: 6 },
      material: { count: 4, qty: 6 }
    },
    status_counts: {
      active: { count: 8, qty: 8 },
      damaged: { count: 2, qty: 4 }
    },
    category_counts: {
      'IT': { count: 5, qty: 5 }
    },
    location_count: 3
  });

  const stats = await getReportStats();
  assert.equal(stats.totalItems, 10);
  assert.equal(stats.totalQuantity, 12);
  assert.equal(stats.typeCounts.asset.count, 6);
  assert.equal(stats.locationCount, 3);
});

test('getReportItemsForExport fetches filtered items lists', async () => {
  mockSupabaseRegistry.clear();

  const mockItems = [
    { id: '1', item_name: 'Laptop Dell', quantity: 2, status: 'active', item_type: 'asset' },
    { id: '2', item_name: 'Paper A4', quantity: 10, status: 'active', item_type: 'material' }
  ];
  mockSupabaseRegistry.setTableResponse('items', mockItems);

  const items = await getReportItemsForExport({
    q: 'Laptop',
    status: 'active'
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].item_name, 'Laptop Dell');
  assert.deepEqual(mockSupabaseRegistry.getRpcLog(), []);
});

test('getReportItemsList sends filters, Thai sort and pagination to paginated report RPC', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setTableResponse('items', [
    { id: 'table-1', item_name: 'Full table row', quantity: 1, status: 'active', item_type: 'asset' },
    { id: 'table-2', item_name: 'Another table row', quantity: 1, status: 'active', item_type: 'asset' },
  ]);
  mockSupabaseRegistry.setRpcResponse('get_report_items_page', {
    items: [
      {
        id: 'rpc-1',
        item_name: 'RPC page row',
        item_type: 'asset',
        quantity: 2,
        asset_no: null,
        serial_no: null,
        brand: null,
        model: null,
        responsible_person: null,
        status: 'active',
        updated_at: '2026-01-01T00:00:00.000Z',
        category: null,
        unit: null,
        location: null,
      },
    ],
    total_count: 40,
    total_quantity: 80,
    total_value: 120000,
    total_pages: 3,
    page: 2,
    audited_count: 4,
    overdue_audit_items: [
      {
        id: 'overdue-1',
        item_name: 'เครื่องพิมพ์ชำรุด',
        item_type: 'asset',
        quantity: 1,
        asset_no: null,
        serial_no: null,
        brand: null,
        model: null,
        responsible_person: null,
        status: 'damaged',
        updated_at: '2026-01-02T00:00:00.000Z',
        category: null,
        unit: null,
        location: null,
      },
    ],
  });

  const result = await getReportItemsList({
    q: 'Laptop',
    type: 'asset',
    status: 'active',
    category_id: '11111111-1111-1111-1111-111111111111',
    location_id: '22222222-2222-2222-2222-222222222222',
    sort_by: 'item_name',
    sort_dir: 'asc',
    page: '2',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'rpc-1');
  assert.equal(result.totalCount, 40);
  assert.equal(result.totalPages, 3);
  assert.equal(result.page, 2);
  assert.equal(result.totalQuantity, 80);
  assert.equal(result.totalValue, 120000);
  assert.equal(result.auditedCount, 4);
  assert.equal(result.overdueAuditItems.length, 1);
  assert.equal(result.overdueAuditItems[0].id, 'overdue-1');
  assert.deepEqual(mockSupabaseRegistry.getQueryLog().map((entry) => entry.table), []);
  assert.deepEqual(mockSupabaseRegistry.getRpcLog(), [
    {
      name: 'get_report_items_page',
      args: {
        p_q: 'laptop',
        p_type: 'asset',
        p_status: 'active',
        p_category_id: '11111111-1111-1111-1111-111111111111',
        p_location_id: '22222222-2222-2222-2222-222222222222',
        p_sort_by: 'item_name',
        p_sort_dir: 'asc',
        p_page: 2,
        p_page_size: 15,
      },
    },
  ]);
});

test('report RPC migration preserves Thai collation for text ordering', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/00021_report_items_page_rpc.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migration, /item_name COLLATE "th-TH-x-icu"/);
  assert.match(migration, /category_name COLLATE "th-TH-x-icu"/);
});
