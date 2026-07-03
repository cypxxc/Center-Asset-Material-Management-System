import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { getReportStats } from '../../features/reports/queries';
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
});
