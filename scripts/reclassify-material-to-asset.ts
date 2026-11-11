import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import ExcelJS from 'exceljs'
import path from 'path'

dotenv.config({ path: '.env.postgres.app' })

export const MIGRATION_BATCH_ID = 'batch_reclassify_material_to_asset_20261111'

function cleanCellText(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && val.text) return String(val.text).trim()
  if (typeof val === 'object' && val.result) return String(val.result).trim()
  return String(val).trim()
}

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
}

export async function runPreviewAndVerification() {
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    const matRes = await client.query(`
      SELECT id, item_name, asset_no, serial_no, qualification_status, unit_price,
             category_id, location_id, unit_id, note, budget_source, depreciation_enabled
      FROM public.items
      WHERE deleted_at IS NULL AND item_type = 'material'
      ORDER BY id
    `)

    const excelPath = path.join(process.cwd(), 'docs', 'ทะเบียนครุภัณฑ์ ปีงปม.พ.ศ.2570(2).xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(excelPath)

    const excelAssets = new Set<string>()
    wb.worksheets.forEach((ws) => {
      let headerRowIdx = -1
      for (let r = 5; r <= 9; r++) {
        let found = false
        ws.getRow(r).eachCell((c) => {
          if (cleanCellText(c.value).includes('ลำดับ')) found = true
        })
        if (found) { headerRowIdx = r; break }
      }
      if (headerRowIdx === -1) return

      const assetCols: number[] = []
      ws.getRow(headerRowIdx).eachCell((cell, colNumber) => {
        const text = cleanCellText(cell.value)
        if (text.includes('เลขครุภัณฑ์') || text.includes('ทะเบียนกำหนดใหม่')) assetCols.push(colNumber)
      })

      for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
        const seqVal = cleanCellText(ws.getRow(r).getCell(1).value)
        if (!seqVal || !/^\d+$/.test(seqVal)) continue
        const parts = assetCols.map(col => cleanCellText(ws.getRow(r).getCell(col).value)).filter(Boolean)
        const rawAssetNo = parts.join(' ').trim()
        if (rawAssetNo && rawAssetNo !== '-') {
          excelAssets.add(normalize(rawAssetNo))
        }
      }
    })

    let verifiedCount = 0
    let exactMatches = 0
    let derivativeMatches = 0
    const unverified: any[] = []

    for (const item of matRes.rows) {
      const norm = normalize(item.asset_no)
      if (excelAssets.has(norm)) {
        verifiedCount++
        exactMatches++
      } else {
        const base = norm.replace(/\s*\((?:จอ|ชิ้นที่\s*\d+)\)\s*$/, '').trim()
        if (excelAssets.has(base)) {
          verifiedCount++
          derivativeMatches++
        } else {
          unverified.push(item)
        }
      }
    }

    const qualCounts = await client.query(`
      SELECT item_type, qualification_status, count(*)
      FROM public.items
      WHERE deleted_at IS NULL
      GROUP BY item_type, qualification_status
      ORDER BY item_type, qualification_status
    `)

    return {
      totalMaterial: matRes.rows.length,
      verifiedCount,
      exactMatches,
      derivativeMatches,
      unverified,
      qualCounts: qualCounts.rows,
      items: matRes.rows
    }
  } finally {
    client.release()
    await pool.end()
  }
}

export async function applyReclassification(adminUserId: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('camms_material_reclassify'))`)
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [adminUserId])

    const adminCheck = await client.query(`
      SELECT id FROM public.profiles WHERE id = $1 AND role = 'admin' AND is_active = true
    `, [adminUserId])
    if (!adminCheck.rows.length) throw new Error('Admin authorization required')

    const targetItems = await client.query(`
      SELECT id, asset_no, qualification_status
      FROM public.items
      WHERE deleted_at IS NULL AND item_type = 'material'
      FOR UPDATE
    `)

    if (targetItems.rows.length !== 677) {
      throw new Error(`Target count mismatch: expected 677, found ${targetItems.rows.length}`)
    }

    let updatedCount = 0
    for (const row of targetItems.rows) {
      const updateRes = await client.query(`
        UPDATE public.items
        SET item_type = 'asset',
            updated_by = $1,
            updated_at = now()
        WHERE id = $2 AND item_type = 'material' AND deleted_at IS NULL
        RETURNING id
      `, [adminUserId, row.id])

      if (updateRes.rowCount !== 1) {
        throw new Error(`Failed to update item ${row.id}`)
      }

      await client.query(`
        INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        VALUES (
          $1,
          'reclassify_material_to_asset',
          'items',
          $2,
          $3::jsonb,
          $4::jsonb
        )
      `, [
        adminUserId,
        row.id,
        JSON.stringify({ item_type: 'material', batch_id: MIGRATION_BATCH_ID }),
        JSON.stringify({ item_type: 'asset', batch_id: MIGRATION_BATCH_ID, asset_no: row.asset_no, qualification_status: row.qualification_status })
      ])
      updatedCount++
    }

    await client.query('COMMIT')
    return { success: true, updatedCount }

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

export async function rollbackReclassification(adminUserId: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('camms_material_reclassify'))`)
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [adminUserId])

    const auditRes = await client.query(`
      SELECT target_id
      FROM public.audit_logs
      WHERE action = 'reclassify_material_to_asset'
        AND (new_data->>'batch_id') = $1
    `, [MIGRATION_BATCH_ID])

    let rolledBackCount = 0
    for (const row of auditRes.rows) {
      const res = await client.query(`
        UPDATE public.items
        SET item_type = 'material',
            updated_by = $1,
            updated_at = now()
        WHERE id = $2 AND item_type = 'asset' AND deleted_at IS NULL
        RETURNING id
      `, [adminUserId, row.target_id])

      if (res.rowCount === 1) rolledBackCount++
    }

    await client.query('COMMIT')
    return { success: true, rolledBackCount }

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  const isApply = process.argv.includes('--apply')
  const isRollback = process.argv.includes('--rollback')

  if (!isApply && !isRollback) {
    console.log('=== RUNNING PREVIEW & VERIFICATION ===')
    const preview = await runPreviewAndVerification()
    console.log(`Total Material items in DB: ${preview.totalMaterial}`)
    console.log(`Verified against Excel: ${preview.verifiedCount}`)
    console.log(`  - Exact Asset No match: ${preview.exactMatches}`)
    console.log(`  - Derivative Asset No match (with (จอ) or (ชิ้นที่ 2)): ${preview.derivativeMatches}`)
    console.log(`Unverified items: ${preview.unverified.length}`)
    console.log('\nCurrent Qualification Distribution in DB:')
    console.log(preview.qualCounts)
    process.exit(0)
  }

  // Find admin user
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const res = await pool.query("SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true LIMIT 1")
  await pool.end()
  if (!res.rows.length) throw new Error('No admin found')
  const adminId = res.rows[0].id

  if (isApply) {
    console.log('=== EXECUTING RECLASSIFICATION APPLY ===')
    const result = await applyReclassification(adminId)
    console.log('Apply Success:', result)
    process.exit(0)
  }

  if (isRollback) {
    console.log('=== EXECUTING ROLLBACK ===')
    const result = await rollbackReclassification(adminId)
    console.log('Rollback Success:', result)
    process.exit(0)
  }
}

if (process.argv[1]?.includes('reclassify-material-to-asset')) {
  main().catch(err => { console.error(err); process.exit(1); })
}
