import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { sql } from 'drizzle-orm'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { withIdentity, type PostgresTransaction } from '@/lib/postgres/db'
import { AuthorizationError } from '@/lib/errors'
import {
  buildQualificationMappings,
  getSheetQualificationStatus,
  type SourceRow,
  type Status,
} from './qualification-mapping-core'

export type { Mapping, SourceRow, Status } from './qualification-mapping-core'

export type QualificationMappingPreview = {
  eligible: number
  qualified: number
  belowThreshold: number
  alreadyApplied: number
  existingStatusesToCorrect: number
  ambiguousSourceIds: number
  ambiguousDatabaseIds: number
  unmatchedSource: number
  unmatchedDatabase: number
  sourceTotalWithAssetNo: number
  sourceTotalWithoutAssetNo: number
}

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
}

function cleanCellText(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && 'text' in (val as Record<string, unknown>)) {
    return String((val as { text?: unknown }).text ?? '').trim()
  }
  if (typeof val === 'object' && 'result' in (val as Record<string, unknown>)) {
    return String((val as { result?: unknown }).result ?? '').trim()
  }
  return String(val).trim()
}

export function getAuthoritativeWorkbookPath(): string {
  const preferred = path.join(process.cwd(), 'docs', 'ทะเบียนครุภัณฑ์ ปีงปม.พ.ศ.2570(2).xlsx')
  if (fs.existsSync(preferred)) return preferred
  return path.join(process.cwd(), 'docs', 'ทะเบียนครุภัณฑ์ ปีงปม.พ.ศ.2570.xlsx')
}

export async function readAuthoritativeSourceRows(): Promise<{
  rows: SourceRow[]
  totalWithAsset: number
  totalWithoutAsset: number
}> {
  const workbook = new ExcelJS.Workbook()
  const workbookPath = getAuthoritativeWorkbookPath()
  await workbook.xlsx.readFile(workbookPath)

  const rows: SourceRow[] = []
  let totalWithAsset = 0
  let totalWithoutAsset = 0

  workbook.worksheets.forEach((sheet) => {
    const headingTexts: string[] = []
    for (let rowNumber = 1; rowNumber <= 6; rowNumber++) {
      sheet.getRow(rowNumber).eachCell((cell) => headingTexts.push(cleanCellText(cell.value)))
    }
    const sheetStatus = getSheetQualificationStatus(sheet.name, headingTexts)

    // Locate header row containing 'ลำดับ'
    let headerRowIdx = -1
    for (let r = 5; r <= 9; r++) {
      const row = sheet.getRow(r)
      let found = false
      row.eachCell((c) => {
        if (cleanCellText(c.value).includes('ลำดับ')) found = true
      })
      if (found) {
        headerRowIdx = r
        break
      }
    }
    if (headerRowIdx === -1) return

    // Dynamically identify asset number and item name columns
    let colName = -1
    const assetCols: number[] = []

    sheet.getRow(headerRowIdx).eachCell((cell, colNumber) => {
      const text = cleanCellText(cell.value)
      if (text.includes('รายการครุภัณฑ์') || text === 'รายการ') colName = colNumber
      if (text.includes('เลขครุภัณฑ์') || text.includes('ทะเบียนกำหนดใหม่')) {
        assetCols.push(colNumber)
      }
    })

    // Sub-header condition check for start row
    const subHRow = sheet.getRow(headerRowIdx + 1)
    let colConditionUsable = -1
    subHRow.eachCell((cell, colNumber) => {
      const text = cleanCellText(cell.value)
      if (text.includes('ใช้งานได้') || text.includes('สภาพพัสดุ')) colConditionUsable = colNumber
    })

    const startDataRow = headerRowIdx + (colConditionUsable !== -1 ? 2 : 1)

    for (let r = startDataRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const seqVal = cleanCellText(row.getCell(1).value)
      if (!seqVal || !/^\d+$/.test(seqVal)) continue

      const nameVal = cleanCellText(colName !== -1 ? row.getCell(colName).value : '')
      if (!nameVal || nameVal === '-' || nameVal.includes('รวม')) continue

      const parts = assetCols.map((col) => cleanCellText(row.getCell(col).value)).filter(Boolean)
      const rawAssetNo = parts.join(' ').trim()

      if (rawAssetNo && rawAssetNo !== '-') {
        totalWithAsset++
        rows.push({
          assetNo: normalize(rawAssetNo),
          status: sheetStatus,
        })
      } else {
        totalWithoutAsset++
      }
    }
  })

  return { rows, totalWithAsset, totalWithoutAsset }
}

export async function calculateMappingsInTx(tx: PostgresTransaction, lock = false) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('camms_qualification_mapping'))`)
  const admin = await tx.execute(sql`
    select id from public.profiles
    where id = current_setting('app.user_id')::uuid and role = 'admin' and is_active for share
  `)
  if (!admin.rows.length) throw new AuthorizationError('Admin permission required')

  const { rows: source, totalWithAsset, totalWithoutAsset } = await readAuthoritativeSourceRows()
  const dbRows = await tx.execute<{ id: string; asset_no: string; qualification_status: Status | null }>(sql`
    select id, asset_no, qualification_status from public.items
    where deleted_at is null and asset_no is not null ${lock ? sql`for update` : sql``}
  `)

  const plan = buildQualificationMappings(source, dbRows.rows)

  return {
    mappings: plan.mappings,
    summary: {
      eligible: plan.mappings.length,
      qualified: plan.mappings.filter((row) => row.qualification_status === 'qualified').length,
      belowThreshold: plan.mappings.filter((row) => row.qualification_status === 'below_threshold').length,
      alreadyApplied: plan.alreadyApplied,
      existingStatusesToCorrect: plan.mappings.filter((row) => row.previousStatus !== null).length,
      ambiguousSourceIds: plan.ambiguousSourceIds,
      ambiguousDatabaseIds: plan.ambiguousDatabaseIds,
      unmatchedSource: plan.unmatchedSource,
      unmatchedDatabase: plan.unmatchedDatabase,
      sourceTotalWithAssetNo: totalWithAsset,
      sourceTotalWithoutAssetNo: totalWithoutAsset,
    },
  }
}

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') throw new AuthorizationError('Admin permission required')
  return profile
}

export async function previewQualificationMapping(): Promise<QualificationMappingPreview> {
  await requireAdmin()
  return withUserDatabase(async (tx) => {
    const { summary } = await calculateMappingsInTx(tx, false)
    return summary
  })
}

export async function applyQualificationMapping(expected: { eligible: number; qualified: number; belowThreshold: number }) {
  await requireAdmin()
  return withUserDatabase(async (tx) => {
    const { mappings, summary } = await calculateMappingsInTx(tx, true)
    if (
      summary.eligible !== expected.eligible ||
      summary.qualified !== expected.qualified ||
      summary.belowThreshold !== expected.belowThreshold
    ) {
      throw new Error(`Mapping preview changed (expected ${expected.eligible}, got ${summary.eligible}). Run preview again before applying.`)
    }

    let updated = 0
    for (const mapping of mappings) {
      const result = await tx.execute(sql`
        update public.items
        set qualification_status = ${mapping.qualification_status},
            updated_by = current_setting('app.user_id')::uuid,
            updated_at = now()
        where id = ${mapping.id}::uuid
          and asset_no = ${mapping.asset_no}
          and deleted_at is null
          and qualification_status is not distinct from ${mapping.previousStatus}
        returning id
      `)
      if (!result.rows.length) {
        throw new Error('A mapped record changed concurrently. Transaction rolled back; run preview again.')
      }

      await tx.execute(sql`
        insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        values (
          current_setting('app.user_id')::uuid,
          'qualification_mapping',
          'items',
          ${mapping.id}::uuid,
          ${JSON.stringify({ qualification_status: mapping.previousStatus })}::jsonb,
          ${JSON.stringify({ qualification_status: mapping.qualification_status, asset_no: mapping.asset_no })}::jsonb
        )
      `)
      updated++
    }

    return { updated, qualified: summary.qualified, belowThreshold: summary.belowThreshold }
  })
}

export async function executeAdminQualificationMapping(
  adminUserId: string,
  expected?: { eligible: number; qualified: number; belowThreshold: number }
) {
  return withIdentity(adminUserId, async (tx) => {
    const { mappings, summary } = await calculateMappingsInTx(tx, true)
    if (expected) {
      if (
        summary.eligible !== expected.eligible ||
        summary.qualified !== expected.qualified ||
        summary.belowThreshold !== expected.belowThreshold
      ) {
        throw new Error(`Mapping preview mismatch (expected ${expected.eligible}, got ${summary.eligible})`)
      }
    }

    let updated = 0
    for (const mapping of mappings) {
      const result = await tx.execute(sql`
        update public.items
        set qualification_status = ${mapping.qualification_status},
            updated_by = current_setting('app.user_id')::uuid,
            updated_at = now()
        where id = ${mapping.id}::uuid
          and asset_no = ${mapping.asset_no}
          and deleted_at is null
          and qualification_status is not distinct from ${mapping.previousStatus}
        returning id
      `)
      if (!result.rows.length) {
        throw new Error(`Item ${mapping.id} failed to update`)
      }

      await tx.execute(sql`
        insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        values (
          current_setting('app.user_id')::uuid,
          'qualification_mapping',
          'items',
          ${mapping.id}::uuid,
          ${JSON.stringify({ qualification_status: mapping.previousStatus })}::jsonb,
          ${JSON.stringify({ qualification_status: mapping.qualification_status, asset_no: mapping.asset_no })}::jsonb
        )
      `)
      updated++
    }

    return { updated, qualified: summary.qualified, belowThreshold: summary.belowThreshold, summary }
  })
}
