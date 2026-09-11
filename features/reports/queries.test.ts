import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../../tests/mocks/supabase'
import { getExportReportItems } from './queries'

test('getExportReportItems function exists and accepts search parameters', () => {
  assert.equal(typeof getExportReportItems, 'function')
})

test('getExportReportItems queries get_report_items_page RPC with page 1 and page size 5000', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setRpcResponse('get_report_items_page', {
    items: [
      {
        id: 'export-1',
        item_name: 'โต๊ะทำงาน',
        item_type: 'asset',
        quantity: 5,
        unit_price: 2500,
        asset_no: 'AS-001',
        serial_no: null,
        brand: 'Logitech',
        model: 'MK270',
        responsible_person: 'สมชาย',
        status: 'active',
        updated_at: '2026-01-01T00:00:00.000Z',
        category: { id: 'cat-1', name: 'ครุภัณฑ์สำนักงาน' },
        unit: { id: 'unit-1', name: 'ตัว' },
        location: { id: 'loc-1', name: 'ห้อง 101' },
      },
    ],
    total_count: 1,
    total_quantity: 5,
    total_value: 12500,
  })

  const result = await getExportReportItems({
    q: 'โต๊ะ',
    type: 'asset',
    status: 'active',
    category_id: 'cat-1',
    location_id: 'loc-1',
  })

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].id, 'export-1')
  assert.equal(result.totalCount, 1)
  assert.equal(result.totalQuantity, 5)
  assert.equal(result.totalValue, 12500)

  const rpcCalls = mockSupabaseRegistry.getRpcLog()
  assert.equal(rpcCalls.length, 1)
  assert.equal(rpcCalls[0].name, 'get_report_items_page')
  assert.equal(rpcCalls[0].args?.p_page, 1)
  assert.equal(rpcCalls[0].args?.p_page_size, 5000)
  assert.equal(rpcCalls[0].args?.p_q, 'โต๊ะ')
  assert.equal(rpcCalls[0].args?.p_type, 'asset')
  assert.equal(rpcCalls[0].args?.p_status, 'active')
  assert.equal(rpcCalls[0].args?.p_category_id, 'cat-1')
  assert.equal(rpcCalls[0].args?.p_location_id, 'loc-1')
})

test('getExportReportItems handles RPC error gracefully', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setRpcResponse('get_report_items_page', null, { message: 'Database error' })

  const result = await getExportReportItems({})
  assert.equal(result.items.length, 0)
  assert.equal(result.totalCount, 0)
  assert.equal(result.totalQuantity, 0)
  assert.equal(result.totalValue, 0)
})
