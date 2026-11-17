import '../setup/dom'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.postgres.app' })
import test from 'node:test'
import assert from 'node:assert/strict'

function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

const actor = '9fb066ea-f19e-4c3b-b6cd-915338875821'
mockModule('../../features/auth/queries', {
  getCurrentProfile: async () => ({ id: actor, role: 'admin', is_active: true }),
})

test('importPostgresItems detects intra-file duplicate asset numbers and reports row numbers', async () => {
  const { importPostgresItems } = await import('../../features/items/postgres-actions')
  const rows = [
    {
      item_name: 'โต๊ะทำงาน A',
      item_type: 'asset',
      category_name: 'ครุภัณฑ์สำนักงาน',
      location_name: 'ห้อง 101',
      unit_name: 'ตัว',
      quantity: 1,
      unit_price: 2500,
      status: 'active',
      asset_no: 'AS-TEST-DUP-01',
      serial_no: null,
      brand: null,
      model: null,
      responsible_person: null,
      note: null,
    },
    {
      item_name: 'โต๊ะทำงาน B',
      item_type: 'asset',
      category_name: 'ครุภัณฑ์สำนักงาน',
      location_name: 'ห้อง 102',
      unit_name: 'ตัว',
      quantity: 1,
      unit_price: 2500,
      status: 'active',
      asset_no: 'AS-TEST-DUP-01', // Duplicate asset_no
      serial_no: null,
      brand: null,
      model: null,
      responsible_person: null,
      note: null,
    },
  ]

  const res = await importPostgresItems(rows)
  assert.equal(res.data, null)
  assert.ok(res.error)
  assert.match(res.error.message, /แถวที่ 2: "AS-TEST-DUP-01" \(โต๊ะทำงาน B\)/)
  assert.match(res.error.message, /ตรงกับแถวที่ 1: \(โต๊ะทำงาน A\)/)
})

test('importPostgresItems detects collisions against existing database records and lists details', { skip: process.env.POSTGRES_LIVE_TEST !== '1' }, async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('Skipping live database test when DATABASE_URL is not set')
    return
  }
  const { Client } = await import('pg')
  const client = new Client({ connectionString: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  await client.connect()
  try {
    await client.query("INSERT INTO public.profiles(id, full_name, email, role, is_active) VALUES ($1, 'Admin Fixture', 'admin-fixture@test.invalid', 'admin', true) ON CONFLICT (id) DO NOTHING", [actor])
    await client.query("INSERT INTO public.items(item_name, item_type, asset_no, quantity, status) SELECT 'ชุดโต๊ะไม้สีน้ำตาลผู้บริหาร', 'asset', 'สขส 7. 7110-007-0010-1/58', 1, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.items WHERE asset_no = 'สขส 7. 7110-007-0010-1/58' AND deleted_at IS NULL)")
  } finally {
    await client.end()
  }
  const { importPostgresItems } = await import('../../features/items/postgres-actions')
  const rows = [
    {
      item_name: 'ชุดโต๊ะไม้ผู้บริหาร ทดสอบซ้ำ',
      item_type: 'asset',
      category_name: 'ครุภัณฑ์สำนักงาน',
      location_name: 'สำนักงานเขตสุขภาพที่ 7',
      unit_name: 'ชุด',
      quantity: 1,
      unit_price: 10000,
      status: 'active',
      asset_no: 'สขส 7. 7110-007-0010-1/58', // This asset_no is already in the database from the 888 real items!
      serial_no: null,
      brand: null,
      model: null,
      responsible_person: null,
      note: null,
    },
  ]

  const res = await importPostgresItems(rows)
  assert.equal(res.data, null)
  assert.ok(res.error)
  assert.match(res.error.message, /พบเลขครุภัณฑ์ซ้ำกับที่มีอยู่ในระบบแล้ว/)
  assert.match(res.error.message, /สขส 7\. 7110-007-0010-1\/58/)
  assert.match(res.error.message, /ชุดโต๊ะไม้ผู้บริหาร ทดสอบซ้ำ/)
  assert.match(res.error.message, /ชุดโต๊ะไม้สีน้ำตาลผู้บริหาร/) // Existing item name in database!
})

