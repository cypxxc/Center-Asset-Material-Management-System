import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

type Batch = { items: { id: string; note: string; unit_price: number | null }[]; next_cursor: unknown }

test('report exports traverse more than 5000 rows with stable cursors, bounded pages and caller RLS', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE COLLATION IF NOT EXISTS "th-TH-x-icu" (provider = icu, locale = 'th-TH');
      CREATE TABLE categories (id uuid PRIMARY KEY, name text);
      CREATE TABLE units (id uuid PRIMARY KEY, name text);
      CREATE TABLE locations (id uuid PRIMARY KEY, name text);
      CREATE TABLE items (id uuid PRIMARY KEY, item_name text, item_type text, quantity int,
        unit_price numeric, asset_no text, serial_no text, brand text, model text,
        responsible_person text, status text, note text, created_at timestamptz,
        updated_at timestamptz, deleted_at timestamptz, category_id uuid, unit_id uuid, location_id uuid);
      INSERT INTO categories VALUES ('00000000-0000-0000-0000-000000000001', 'ก'), ('00000000-0000-0000-0000-000000000002', 'ข');
      INSERT INTO units VALUES ('00000000-0000-0000-0000-000000000001', 'unit');
      INSERT INTO locations VALUES ('00000000-0000-0000-0000-000000000001', 'room');
      INSERT INTO items SELECT md5(n::text)::uuid, CASE WHEN n % 11 = 0 THEN NULL ELSE 'ชื่อ' || (n % 7) END,
        CASE WHEN n % 2 = 0 THEN 'asset' ELSE 'material' END, n % 5,
        CASE WHEN n % 13 = 0 THEN NULL ELSE (n % 9) * 12.34 END,
        'asset' || n, NULL, NULL, NULL, NULL, CASE WHEN n % 3 = 0 THEN 'damaged' ELSE 'active' END,
        'note', CASE WHEN n % 17 = 0 THEN NULL ELSE '2026-01-01'::timestamptz + (n % 4) * interval '1 day' END,
        CASE WHEN n % 19 = 0 THEN NULL ELSE '2026-02-01'::timestamptz + (n % 6) * interval '1 day' END,
        NULL, CASE WHEN n % 3 = 0 THEN NULL ELSE ('00000000-0000-0000-0000-' || lpad((n % 2 + 1)::text,12,'0'))::uuid END,
        '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
      FROM generate_series(1, 5107) n;
      ALTER TABLE items ENABLE ROW LEVEL SECURITY;
      CREATE POLICY allowed ON items TO authenticated USING (item_type = 'asset');
      GRANT SELECT ON items, categories, units, locations TO authenticated, service_role;
    `)
    await db.exec(readFileSync('db/migrations/20260909015108_bounded_report_exports.sql', 'utf8'))
    const batch = async (sort: string, dir: string, cursor: unknown = null, size = 500) =>
      (await db.query<{ result: Batch }>('SELECT get_report_export_batch(p_sort_by := $1, p_sort_dir := $2, p_after := $3, p_batch_size := $4) AS result', [sort, dir, cursor, size])).rows[0].result
    await db.exec('SET ROLE service_role')
    const sorts: Record<string, string> = { item_name: 'i.item_name COLLATE "th-TH-x-icu"', category: 'c.name COLLATE "th-TH-x-icu"', quantity: 'quantity', unit_price: 'unit_price', total_price: 'COALESCE(unit_price,0)*quantity', status: 'status', item_type: 'item_type', created_at: 'created_at', updated_at: 'updated_at' }
    for (const [sort, expression] of Object.entries(sorts)) {
      for (const dir of ['asc', 'desc']) {
        let cursor: unknown = null
        const ids: string[] = []
        do {
          const result = await batch(sort, dir, cursor)
          assert.ok(result.items.length <= 500)
          ids.push(...result.items.map(item => item.id))
          cursor = result.next_cursor
        } while (cursor)
        const expected = await db.query<{ id: string }>(`SELECT i.id FROM items i LEFT JOIN categories c ON c.id = i.category_id ORDER BY ${expression} ${dir} NULLS LAST, i.id ASC`)
        assert.deepEqual(ids, expected.rows.map(row => row.id), `${sort} ${dir}`)
        assert.equal(new Set(ids).size, 5107)
      }
    }
    assert.equal((await batch('updated_at', 'desc', null, 9000)).items.length, 1000)
    const page = (await db.query<{ result: { items: unknown[]; overdue_audit_items: unknown[]; total_count: number } }>('SELECT get_report_items_page(p_page_size := 9000) AS result')).rows[0].result
    assert.equal(page.items.length, 1000)
    assert.equal(page.total_count, 5107)
    assert.deepEqual(page.overdue_audit_items, [])
    const filtered = (await db.query<{ result: Batch }>(`SELECT get_report_export_batch(p_q := 'asset', p_type := 'asset', p_status := 'damaged', p_category_id := '00000000-0000-0000-0000-000000000001') AS result`)).rows[0].result
    assert.equal(filtered.items.length, 0)
    const matching = (await db.query<{ result: Batch }>(`SELECT get_report_export_batch(p_q := 'asset', p_type := 'asset', p_status := 'active', p_category_id := '00000000-0000-0000-0000-000000000001', p_location_id := '00000000-0000-0000-0000-000000000001', p_batch_size := 1000) AS result`)).rows[0].result
    const matchingExpected = await db.query<{ id: string }>(`SELECT id FROM items WHERE item_type = 'asset' AND status = 'active' AND category_id = '00000000-0000-0000-0000-000000000001' AND location_id = '00000000-0000-0000-0000-000000000001' ORDER BY updated_at DESC NULLS LAST, id ASC LIMIT 1000`)
    assert.equal(matching.items.length, 1000)
    assert.deepEqual(matching.items.map(item => item.id), matchingExpected.rows.map(item => item.id))
    assert.equal(matching.items[0].note, 'note')
    for (const cursor of [{}, { id: 'bad', value: 1 }, { id: '00000000-0000-0000-0000-000000000001', value: {} }, { id: '00000000-0000-0000-0000-000000000001', value: 'bad-number' }]) {
      await assert.rejects(batch('quantity', 'asc', cursor))
    }
    await db.exec('RESET ROLE; SET ROLE authenticated')
    let cursor: unknown = null
    let count = 0
    do { const result = await batch('quantity', 'desc', cursor); count += result.items.length; cursor = result.next_cursor } while (cursor)
    assert.equal(count, 2553)
    const restrictedPage = (await db.query<{ result: { total_count: number } }>('SELECT get_report_items_page() AS result')).rows[0].result
    assert.equal(restrictedPage.total_count, 2553)
    await db.exec('RESET ROLE; SET ROLE anon')
    await assert.rejects(batch('quantity', 'asc'), /permission denied/)
    await assert.rejects(db.query('SELECT get_report_items_page()'), /permission denied/)
  } finally { await db.close() }
})
