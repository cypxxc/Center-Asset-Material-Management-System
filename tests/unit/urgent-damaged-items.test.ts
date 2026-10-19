import '../setup/dom'
import { mockSupabaseRegistry } from '../mocks/supabase'
import test from 'node:test'
import assert from 'node:assert/strict'

type MockQueryResult = { rows: Record<string, unknown>[] }
type MockTx = { execute: (query: unknown) => Promise<MockQueryResult> }
type MockTxExecute = (query: unknown) => Promise<MockQueryResult>

// Set up postgres request mock before importing postgres-queries
let mockTxExecute: MockTxExecute | null = null

const requestPath = require.resolve('../../lib/postgres/request')
require.cache[requestPath] = {
  id: requestPath,
  filename: requestPath,
  loaded: true,
  exports: {
    withUserDatabase: async <T>(cb: (tx: MockTx) => Promise<T>): Promise<T> => {
      if (mockTxExecute) {
        return cb({ execute: mockTxExecute })
      }
      return cb({ execute: async () => ({ rows: [] }) })
    },
  },
} as NodeJS.Module

test('getUrgentDamagedItems and getPostgresUrgentDamagedItems are exported', async () => {
  const itemsQueries = await import('../../features/items/queries')
  assert.equal(typeof itemsQueries.getUrgentDamagedItems, 'function')

  const postgresQueries = await import('../../features/items/postgres-queries')
  assert.equal(typeof postgresQueries.getPostgresUrgentDamagedItems, 'function')
})

test('getUrgentDamagedItems queries damaged/waiting_repair items and maps location correctly', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('items', [
    {
      id: 'item-1',
      item_name: 'Printer HP',
      asset_no: 'ASSET-001',
      status: 'damaged',
      updated_at: '2026-10-19T10:00:00Z',
      image_url: null,
      location: { name: 'IT Office' },
    },
    {
      id: 'item-2',
      item_name: 'Projector Epson',
      asset_no: null,
      status: 'waiting_repair',
      updated_at: '2026-10-18T10:00:00Z',
      image_url: null,
      location: null,
    },
  ])

  const { getUrgentDamagedItems } = await import('../../features/items/queries')
  const results = await getUrgentDamagedItems(5)

  // Verify query log
  const queries = mockSupabaseRegistry.getQueryLog().filter((q) => q.table === 'items')
  assert.ok(queries.length >= 1, 'Should query items table')

  const lastQuery = queries[queries.length - 1]
  const operations = lastQuery.operations
  assert.ok(operations.some((op) => op[0] === 'select'))
  assert.ok(operations.some((op) => op[0] === 'in' && op[1] === 'status' && Array.isArray(op[2]) && op[2].includes('damaged') && op[2].includes('waiting_repair')))
  assert.ok(operations.some((op) => op[0] === 'is' && op[1] === 'deleted_at' && op[2] === null))
  assert.ok(operations.some((op) => op[0] === 'order' && op[1] === 'updated_at'))
  assert.ok(operations.some((op) => op[0] === 'limit' && op[1] === 5))

  // Verify mapped results
  assert.equal(results.length, 2)
  assert.equal(results[0].id, 'item-1')
  assert.equal(results[0].item_name, 'Printer HP')
  assert.equal(results[0].asset_no, 'ASSET-001')
  assert.equal(results[0].locationName, 'IT Office')
  assert.equal(results[0].status, 'damaged')

  // Fallback location for item without location
  assert.equal(results[1].id, 'item-2')
  assert.equal(results[1].locationName, 'ไม่มีระบุสถานที่')
  assert.equal(results[1].status, 'waiting_repair')
})

test('getPostgresUrgentDamagedItems executes correct SQL query and formats fields', async () => {
  let executedQuery: unknown = null
  mockTxExecute = async (query: unknown) => {
    executedQuery = query
    return {
      rows: [
        {
          id: 'pg-item-1',
          item_name: 'Broken AC',
          asset_no: 'ASSET-999',
          locationName: 'Server Room',
          status: 'damaged',
          updated_at: new Date('2026-10-19T08:00:00Z'),
          image_url: null,
        },
      ],
    }
  }

  const { getPostgresUrgentDamagedItems } = await import('../../features/items/postgres-queries')
  const results = await getPostgresUrgentDamagedItems(3)

  assert.ok(executedQuery, 'Should execute SQL query')
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'pg-item-1')
  assert.equal(results[0].locationName, 'Server Room')
  assert.equal(results[0].updated_at, '2026-10-19T08:00:00.000Z')
  assert.equal(results[0].status, 'damaged')

  mockTxExecute = null
})
