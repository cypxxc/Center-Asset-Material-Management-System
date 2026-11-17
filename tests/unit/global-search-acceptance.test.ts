import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

const dialect = new PgDialect()
const statements: { sql: string; params: unknown[] }[] = []
let responses: unknown[][] = []
let authorized = true
const requestPath = require.resolve('../../lib/postgres/request')
require.cache[requestPath] = {
  id: requestPath,
  filename: requestPath,
  loaded: true,
  exports: {
    withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => {
      if (!authorized) throw new Error('Unauthenticated')
      return callback({
        execute: async (query: SQL) => {
          statements.push(dialect.sqlToQuery(query))
          return { rows: responses.shift() ?? [] }
        },
      } as unknown as PostgresTransaction)
    },
  },
} as NodeJS.Module

beforeEach(() => {
  process.env.DATA_BACKEND = 'postgres'
  statements.length = 0
  responses = []
  authorized = true
})

// 1. ค้นหาชื่อครุภัณฑ์เต็ม -> พบข้อมูล
test('Acceptance 1: ค้นหาชื่อครุภัณฑ์เต็ม (Full item_name)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', item_name: 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูง Dell Precision 3660' }]]
  const result = await getItems({ q: 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูง Dell Precision 3660' })
  assert.equal(result.total, 1)
  assert.equal(result.items[0].item_name, 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูง Dell Precision 3660')
  assert.ok(statements[0].params.includes('%เครื่องคอมพิวเตอร์ประมวลผลระดับสูง dell precision 3660%'))
})

// 2. ค้นหาชื่อเพียงบางส่วน -> พบข้อมูล
test('Acceptance 2: ค้นหาชื่อเพียงบางส่วน (Partial item_name)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', item_name: 'เครื่องคอมพิวเตอร์ประมวลผลระดับสูง' }]]
  const result = await getItems({ q: 'คอมพิวเตอร์' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].params.includes('%คอมพิวเตอร์%'))
})

// 3. ค้นหายี่ห้อ -> พบข้อมูล
test('Acceptance 3: ค้นหายี่ห้อ (Brand)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', brand: 'Dell' }]]
  const result = await getItems({ q: 'Dell' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.brand ilike'))
  assert.ok(statements[0].params.includes('%dell%'))
})

// 4. ค้นหารุ่น -> พบข้อมูล
test('Acceptance 4: ค้นหารุ่น (Model)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', model: 'Precision 3660' }]]
  const result = await getItems({ q: 'Precision 3660' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.model ilike'))
  assert.ok(statements[0].params.includes('%precision 3660%'))
})

// 5. ค้นหา Serial Number -> พบข้อมูล
test('Acceptance 5: ค้นหา Serial Number', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', serial_no: 'SN-DELL-998811' }]]
  const result = await getItems({ q: 'SN-DELL-998811' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.serial_no ilike'))
  assert.ok(statements[0].params.includes('%sn-dell-998811%'))
})

// 6. ค้นหาเลขครุภัณฑ์ -> พบข้อมูล
test('Acceptance 6: ค้นหาเลขครุภัณฑ์ (Asset Number)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', asset_no: 'EQ-7110-001/67' }]]
  const result = await getItems({ q: 'EQ-7110-001/67' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.asset_no ilike'))
  assert.ok(statements[0].params.includes('%eq-7110-001/67%'))
})

// 7. ค้นหาเลขสินทรัพย์ -> พบข้อมูล
test('Acceptance 7: ค้นหาเลขสินทรัพย์ (GFMIS Number)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', gfmis_number: '110000069558' }]]
  const result = await getItems({ q: '110000069558' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.gfmis_number ilike'))
  assert.ok(statements[0].params.includes('%110000069558%'))
})

// 8. ค้นหาสถานที่ใช้งาน -> พบข้อมูล
test('Acceptance 8: ค้นหาสถานที่ใช้งาน (Location Name / Building / Room)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', location: { name: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' } }]]
  const result = await getItems({ q: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('public.locations'))
  assert.ok(statements[0].params.includes('%ห้องปฏิบัติการคอมพิวเตอร์ 1%'))
})

// 9. ค้นหาผู้ครอบครอง -> พบข้อมูล
test('Acceptance 9: ค้นหาผู้ครอบครอง (Responsible Person)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', responsible_person: 'นายสมชาย วิศวกรรม' }]]
  const result = await getItems({ q: 'นายสมชาย วิศวกรรม' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.responsible_person ilike'))
  assert.ok(statements[0].params.includes('%นายสมชาย วิศวกรรม%'))
})

// 10. ค้นหาด้วยตัวเลขราคา -> พบข้อมูล
test('Acceptance 10: ค้นหาด้วยตัวเลขราคา (Price number and comma formatted)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', unit_price: 65000 }]]
  const result = await getItems({ q: '65,000' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.unit_price::text ilike'))
  assert.ok(statements[0].params.includes('%65000%'))
})

// 11. ค้นหาข้อมูลที่อยู่หน้าถัดไป -> พบข้อมูล (Search works before Pagination across entire database)
test('Acceptance 11: ค้นหาข้อมูลที่อยู่หน้าถัดไป (Pagination with Search)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 75 }], [{ id: 'item-51', item_name: 'คอมพิวเตอร์เครื่องที่ 51' }]]
  const result = await getItems({ q: 'คอมพิวเตอร์', page: '2' }, 50)
  assert.equal(result.total, 75)
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 2)
  // Verify OFFSET was applied AFTER the WHERE filter
  assert.match(statements[1].sql, /limit \$\d+ offset \$\d+/)
  assert.deepEqual(statements[1].params.slice(-2), [50, 50])
})

// 12. ค้นหาพร้อมใช้ Filter -> ผลลัพธ์ถูกต้อง (AND between filters, OR between search fields)
test('Acceptance 13: ค้นหาพร้อมใช้ Filter (Search + Category + Status + Location)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', item_name: 'โต๊ะทำงาน' }]]
  const result = await getItems({
    q: 'โต๊ะ',
    type: 'asset',
    status: 'active',
    category_id: '00000000-0000-4000-8000-000000000001',
    location_id: '00000000-0000-4000-8000-000000000002',
    is_central: 'true',
  })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.deleted_at is null and ('))
  assert.match(statements[0].sql, /and i\.status in \([^)]+\) and i\.category_id = \$\d+::uuid and i\.location_id = \$\d+::uuid and \(i\.item_type='material' OR i\.is_central = true OR i\.note ILIKE '%ส่วนกลาง%'\)/)
  assert.doesNotMatch(statements[0].sql, /where .*and i\.item_type =/)
  assert.match(statements[1].sql, /and i\.item_type = \$\d+ and i\.status in \([^)]+\) and i\.category_id = \$\d+::uuid and i\.location_id = \$\d+::uuid and \(i\.item_type='material' OR i\.is_central = true OR i\.note ILIKE '%ส่วนกลาง%'\)/)
  assert.ok(statements[0].params.includes('asset'))
  assert.ok(statements[0].params.includes('active'))
})

// Additional Acceptance: ค้นหาวันที่รับ (acquired_date) & Buddhist Era year (พ.ศ.)
test('Acceptance 14: ค้นหาวันที่รับและ พ.ศ. (Acquired Date & BE Year)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', acquired_date: '2026-05-15' }]]
  const result = await getItems({ q: '2569' }) // 2569 BE = 2026 CE
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.acquired_date::text ilike'))
  assert.ok(statements[0].params.includes('%2026%'))
})

// Additional Acceptance: ค้นหาหน่วยนับ (Unit Name)
test('Acceptance 15: ค้นหาหน่วยนับ (Unit Name)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', unit: { name: 'เครื่อง' } }]]
  const result = await getItems({ q: 'เครื่อง' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('public.units'))
  assert.ok(statements[0].params.includes('%เครื่อง%'))
})

// Additional Acceptance: ค้นหาสถานะด้วยภาษาไทย
test('Acceptance 16: ค้นหาสถานะด้วยภาษาไทย (Thai Status)', async () => {
  const { getItems } = await import('@/features/items/queries')
  responses = [[{ total: 1 }], [{ id: 'item-1', status: 'damaged' }]]
  const result = await getItems({ q: 'ชำรุด' })
  assert.equal(result.total, 1)
  assert.ok(statements[0].sql.includes('i.status in'))
  assert.ok(statements[0].params.includes('damaged'))
})
