import '../setup/dom'
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

test('getUrgentDamagedItems delegates to PostgreSQL and maps location correctly', async () => {
  mockTxExecute = async () => ({
    rows: [
      {
        id: 'item-1',
        item_name: 'Printer HP',
        asset_no: 'ASSET-001',
        status: 'damaged',
        updated_at: new Date('2026-10-19T10:00:00Z'),
        image_url: null,
        locationName: 'IT Office',
      },
      {
        id: 'item-2',
        item_name: 'Projector Epson',
        asset_no: null,
        status: 'waiting_repair',
        updated_at: new Date('2026-10-18T10:00:00Z'),
        image_url: null,
        locationName: 'ไม่มีระบุสถานที่',
      },
    ],
  })

  const { getUrgentDamagedItems } = await import('../../features/items/queries')
  const results = await getUrgentDamagedItems(5)

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

  mockTxExecute = null
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

test('getPostgresUrgentDamagedItems handles NaN, Infinity, and negative limits safely', async () => {
  const { getPostgresUrgentDamagedItems } = await import('../../features/items/postgres-queries')
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  let capturedLimit: unknown = null
  mockTxExecute = async (query: unknown) => {
    const built = dialect.sqlToQuery(query as Parameters<typeof dialect.sqlToQuery>[0])
    capturedLimit = built.params[built.params.length - 1]
    return { rows: [] }
  }
  await getPostgresUrgentDamagedItems(NaN)
  assert.equal(capturedLimit, 5)

  await getPostgresUrgentDamagedItems(Infinity)
  assert.equal(capturedLimit, 5)

  await getPostgresUrgentDamagedItems(-10)
  assert.equal(capturedLimit, 5)

  await getPostgresUrgentDamagedItems(9999)
  assert.equal(capturedLimit, 100)
})
