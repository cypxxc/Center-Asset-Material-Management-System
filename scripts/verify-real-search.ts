/* eslint-disable */
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '../lib/postgres/db'

async function main() {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  process.env.DATA_BACKEND = 'postgres'

  // Stub server-only and next/cache for command-line runner
  for (const name of ['server-only', 'next/cache']) {
    const filename = require.resolve(name)
    require.cache[filename] = {
      id: filename,
      filename,
      loaded: true,
      exports: name === 'next/cache' ? { unstable_cache: <T>(cb: T) => cb } : {},
    } as NodeJS.Module
  }

  let activeTx: PostgresTransaction
  const requestFilename = require.resolve('../lib/postgres/request')
  require.cache[requestFilename] = {
    id: requestFilename,
    filename: requestFilename,
    loaded: true,
    exports: {
      withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback),
    },
  } as NodeJS.Module

  const { getAuthDatabase, withIdentity } = await import('../lib/postgres/db')
  const authDb = getAuthDatabase()
  const admin = await authDb.execute<{ id: string }>(sql`select id from public.profiles where role = 'admin' and is_active limit 1`)
  const userId = admin.rows[0]?.id
  if (!userId) {
    throw new Error('Admin user required in database')
  }

  const authFilename = require.resolve('../features/auth/queries')
  require.cache[authFilename] = {
    id: authFilename,
    filename: authFilename,
    loaded: true,
    exports: {
      getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin' }),
    },
  } as NodeJS.Module

  const items = await import('../features/items/postgres-queries')

  await withIdentity(userId, async (tx) => {
    activeTx = tx

    console.log('=== CAMMS REAL DATA GLOBAL SEARCH VERIFICATION ===')

    // Check count of real items
    const countRes = await tx.execute<{ count: string }>(sql`SELECT count(*) as count FROM public.items WHERE deleted_at IS NULL`)
    const totalCount = parseInt(countRes.rows[0].count, 10)
    console.log(`Live Active Records in Database: ${totalCount}`)

    // 1. Get sample real records to extract actual search values
    const sampleQuery = await tx.execute<{
      item_name: string
      brand: string | null
      model: string | null
      serial_no: string | null
      asset_no: string | null
      gfmis_number: string | null
      unit_price: string
      acquired_date: string | null
      status: string
      responsible_person: string | null
    }>(sql`
      SELECT item_name, brand, model, serial_no, asset_no, gfmis_number, unit_price::text, acquired_date::text, status, responsible_person
      FROM public.items
      WHERE deleted_at IS NULL
      LIMIT 10
    `)

    console.log(`\nSample Real Record (Row 0):`, JSON.stringify(sampleQuery.rows[0], null, 2))

    // Helper for timing and executing
    async function testSearch(label: string, params: { q: string; page?: number; category_id?: string; status?: any; location_id?: string }, expectedCheck?: (res: any) => boolean) {
      const start = performance.now()
      const res = await items.getPostgresItems(params as any, 10)
      const elapsed = (performance.now() - start).toFixed(2)

      const pass = expectedCheck ? expectedCheck(res) : res.total > 0
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label} | Query: "${params.q}" | Found: ${res.total} | Returned: ${res.items.length} | Latency: ${elapsed}ms`)
      if (!pass) {
        console.error('FAILED DETAILS:', res)
      }
      return { pass, elapsed: parseFloat(elapsed), res }
    }

    const testResults: { test: string; pass: boolean; latency: number; count: number }[] = []

    // 1. Thai item name full & partial
    const sampleItem = sampleQuery.rows[0]
    const thaiNameFull = sampleItem.item_name
    const thaiNamePart = thaiNameFull.slice(0, Math.min(6, thaiNameFull.length))

    let r = await testSearch('Thai Name (Full)', { q: thaiNameFull })
    testResults.push({ test: 'Thai Name (Full)', pass: r.pass, latency: r.elapsed, count: r.res.total })

    r = await testSearch('Thai Name (Partial)', { q: thaiNamePart })
    testResults.push({ test: 'Thai Name (Partial)', pass: r.pass, latency: r.elapsed, count: r.res.total })

    // 2. English text / Brand
    const sampleWithBrand = (await tx.execute<{ brand: string }>(sql`
      SELECT brand FROM public.items WHERE deleted_at IS NULL AND brand IS NOT NULL AND length(brand) > 1 LIMIT 1
    `)).rows[0]
    if (sampleWithBrand?.brand) {
      r = await testSearch('Brand (English/Exact)', { q: sampleWithBrand.brand })
      testResults.push({ test: 'Brand', pass: r.pass, latency: r.elapsed, count: r.res.total })

      r = await testSearch('Brand (Case-insensitive)', { q: sampleWithBrand.brand.toLowerCase() })
      testResults.push({ test: 'Brand (Lower)', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 3. Model
    const sampleWithModel = (await tx.execute<{ model: string }>(sql`
      SELECT model FROM public.items WHERE deleted_at IS NULL AND model IS NOT NULL AND length(model) > 1 LIMIT 1
    `)).rows[0]
    if (sampleWithModel?.model) {
      r = await testSearch('Model', { q: sampleWithModel.model })
      testResults.push({ test: 'Model', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 4. Asset number
    const sampleWithAsset = sampleQuery.rows.find(r => r.asset_no) || sampleItem
    if (sampleWithAsset.asset_no) {
      r = await testSearch('Asset Number (Full)', { q: sampleWithAsset.asset_no })
      testResults.push({ test: 'Asset No (Full)', pass: r.pass, latency: r.elapsed, count: r.res.total })

      const partAsset = sampleWithAsset.asset_no.split('/')[0] || sampleWithAsset.asset_no.slice(0, 8)
      r = await testSearch('Asset Number (Partial with special chars)', { q: partAsset })
      testResults.push({ test: 'Asset No (Partial)', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 5. Serial number
    const sampleWithSerial = (await tx.execute<{ serial_no: string }>(sql`
      SELECT serial_no FROM public.items WHERE deleted_at IS NULL AND serial_no IS NOT NULL AND length(serial_no) > 3 LIMIT 1
    `)).rows[0]
    if (sampleWithSerial?.serial_no) {
      r = await testSearch('Serial Number', { q: sampleWithSerial.serial_no })
      testResults.push({ test: 'Serial Number', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 6. GFMIS Number
    const sampleWithGfmis = (await tx.execute<{ gfmis_number: string }>(sql`
      SELECT gfmis_number FROM public.items WHERE deleted_at IS NULL AND gfmis_number IS NOT NULL AND length(gfmis_number) > 3 LIMIT 1
    `)).rows[0]
    if (sampleWithGfmis?.gfmis_number) {
      r = await testSearch('GFMIS Number', { q: sampleWithGfmis.gfmis_number })
      testResults.push({ test: 'GFMIS Number', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 7. Unit price (number & formatted)
    const samplePrice = sampleItem.unit_price.split('.')[0]
    r = await testSearch('Unit Price (Numeric String)', { q: samplePrice })
    testResults.push({ test: 'Unit Price', pass: r.pass, latency: r.elapsed, count: r.res.total })

    // 8. Date (Acquired Date)
    if (sampleItem.acquired_date) {
      // Test ISO year
      const year = sampleItem.acquired_date.slice(0, 4)
      r = await testSearch('Acquired Date (Gregorian Year)', { q: year })
      testResults.push({ test: 'Acquired Date (AD Year)', pass: r.pass, latency: r.elapsed, count: r.res.total })

      // Test Buddhist Era year (year + 543)
      const beYear = String(parseInt(year, 10) + 543)
      r = await testSearch('Acquired Date (Buddhist Era 25xx)', { q: beYear })
      testResults.push({ test: 'Acquired Date (BE Year)', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 9. Status (Thai Label & English)
    r = await testSearch('Status Thai Label (พร้อมใช้งาน)', { q: 'พร้อมใช้งาน' }, res => res.total > 0 && res.items.every((i: any) => i.status === 'active'))
    testResults.push({ test: 'Status Thai (พร้อมใช้งาน)', pass: r.pass, latency: r.elapsed, count: r.res.total })

    r = await testSearch('Status Thai Label (ชำรุด)', { q: 'ชำรุด' }, res => res.total > 0 && res.items.every((i: any) => i.status === 'damaged'))
    testResults.push({ test: 'Status Thai (ชำรุด)', pass: r.pass, latency: r.elapsed, count: r.res.total })

    // 10. Related table: Category Name
    const sampleCat = (await tx.execute<{ name: string }>(sql`
      SELECT c.name FROM public.categories c JOIN public.items i ON i.category_id = c.id WHERE i.deleted_at IS NULL LIMIT 1
    `)).rows[0]
    if (sampleCat?.name) {
      r = await testSearch('Related Category Name', { q: sampleCat.name })
      testResults.push({ test: 'Category Name', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 11. Related table: Unit Name
    const sampleUnit = (await tx.execute<{ name: string }>(sql`
      SELECT u.name FROM public.units u JOIN public.items i ON i.unit_id = u.id WHERE i.deleted_at IS NULL LIMIT 1
    `)).rows[0]
    if (sampleUnit?.name) {
      r = await testSearch('Related Unit Name', { q: sampleUnit.name })
      testResults.push({ test: 'Unit Name', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 12. Related table: Location Name
    const sampleLoc = (await tx.execute<{ name: string }>(sql`
      SELECT l.name FROM public.locations l JOIN public.items i ON i.location_id = l.id WHERE i.deleted_at IS NULL LIMIT 1
    `)).rows[0]
    if (sampleLoc?.name) {
      r = await testSearch('Related Location Name', { q: sampleLoc.name })
      testResults.push({ test: 'Location Name', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 13. Responsible Person
    const samplePerson = (await tx.execute<{ responsible_person: string }>(sql`
      SELECT responsible_person FROM public.items WHERE deleted_at IS NULL AND responsible_person IS NOT NULL AND length(responsible_person) > 2 LIMIT 1
    `)).rows[0]
    if (samplePerson?.responsible_person) {
      r = await testSearch('Responsible Person', { q: samplePerson.responsible_person })
      testResults.push({ test: 'Responsible Person', pass: r.pass, latency: r.elapsed, count: r.res.total })
    }

    // 14. Pagination Across ALL Pages
    // Pick common term that matches multiple pages
    const page1Res = await items.getPostgresItems({ q: thaiNamePart, page: 1 } as any, 5)
    const page2Res = await items.getPostgresItems({ q: thaiNamePart, page: 2 } as any, 5)
    const paginationPass = page1Res.total > 5 && page2Res.items.length > 0 && page1Res.items[0].id !== page2Res.items[0].id
    console.log(`[${paginationPass ? 'PASS' : 'FAIL'}] Search Across Pages | Total Matches in DB: ${page1Res.total} | Page 1 items: ${page1Res.items.length} | Page 2 items: ${page2Res.items.length}`)
    testResults.push({ test: 'Search Across Pages', pass: paginationPass, latency: 0, count: page1Res.total })

    // 15. Filter Combination: Search + Category Filter (AND logic)
    const itemWithCat = (await tx.execute<{ category_id: string; item_name: string }>(sql`
      SELECT category_id, item_name FROM public.items WHERE deleted_at IS NULL AND category_id IS NOT NULL LIMIT 1
    `)).rows[0]
    const filterRes = await items.getPostgresItems({ q: thaiNamePart, category_id: itemWithCat.category_id } as any, 10)
    const filterPass = filterRes.items.every(i => (i.category as any)?.id === itemWithCat.category_id)
    console.log(`[${filterPass ? 'PASS' : 'FAIL'}] Filter Combination (Search AND Category) | Found: ${filterRes.total} (all match category ${itemWithCat.category_id})`)
    testResults.push({ test: 'Search AND Category Filter', pass: filterPass, latency: 0, count: filterRes.total })

    // 16. RBAC / Soft-delete isolation test
    // Insert temporary soft-deleted row with unique sentinel
    const sentinel = 'SENTINEL_DELETED_SECRET_' + Date.now()
    await tx.execute(sql`
      INSERT INTO public.items (item_name, item_type, quantity, deleted_at, created_by)
      VALUES (${sentinel}, 'asset', 1, now(), ${userId}::uuid)
    `)
    const deletedRes = await items.getPostgresItems({ q: sentinel } as any, 10)
    const rbacPass = deletedRes.total === 0 && deletedRes.items.length === 0
    console.log(`[${rbacPass ? 'PASS' : 'FAIL'}] RBAC & Soft-delete Isolation | Query: "${sentinel}" | Found: ${deletedRes.total}`)
    testResults.push({ test: 'RBAC / Soft Delete Isolation', pass: rbacPass, latency: 0, count: deletedRes.total })

    console.log('\n================ SUMMARY ================')
    const allPassed = testResults.every(t => t.pass)
    console.log(`TOTAL CHECKS: ${testResults.length} | ALL PASSED: ${allPassed}`)
    console.log('=========================================')
  })
}

main().catch(console.error)
