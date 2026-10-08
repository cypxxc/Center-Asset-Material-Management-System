'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { getReportItemsList } from '@/features/reports/queries'
import { ItemListSearchParams } from './types'
import { stripBom, normalizeForStorage, normalizeForSearch } from '@/lib/unicode'
import { logger } from '@/lib/logging'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { checkRateLimit } from '@/lib/rate-limit'
import { startTimer } from '@/lib/performance'
import { writeAuditLog } from '@/lib/audit'
import { handleActionError } from '@/lib/error-handler'
import { metrics } from '@/lib/metrics'
import { getRequestContext, withTraceContext } from '@/lib/tracing'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { isPostgresBackend } from '@/lib/backend'
import { importPostgresItems } from './postgres-actions'
import { requireEditor } from './auth-guard'

function revalidateSidebarCache() {
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidatePath('/', 'layout')
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip the escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

export async function importItemsBulk(csvContent: string): Promise<ActionResponse<{ count: number }>> {
  const timer = startTimer()
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'importItemsBulk', feature: 'items', details: 'Unauthorized bulk import attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  // 1. Rate Limiting
  const rateLimitCheck = await checkRateLimit('importItemsBulk', 10, 60000)
  if (!rateLimitCheck.success) {
    return errorResponse(rateLimitCheck.error!)
  }

  // 2. Input size limits check (5MB)
  if (Buffer.byteLength(csvContent, 'utf8') > 5 * 1024 * 1024) {
    return errorResponse('ขนาดไฟล์ข้อมูลนำเข้าใหญ่เกินกำหนด (สูงสุด 5MB)')
  }

  // Strip UTF-8 BOM if present
  const cleanContent = stripBom(csvContent)
  const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length <= 1) {
    return errorResponse('ไม่พบข้อมูลในไฟล์ CSV')
  }

  // 3. Rows count check (1,000 data rows max)
  if (lines.length > 1001) {
    return errorResponse('จำนวนแถวข้อมูลเกินขีดจำกัด (สูงสุด 1,000 แถวต่อการนำเข้าหนึ่งครั้ง)')
  }

  try {
    const headers = parseCSVLine(lines[0]).map((h) => normalizeForSearch(h))
    if (!headers.includes('item_name')) {
      return errorResponse('ไม่พบหัวคอลัมน์ "item_name" (ชื่อสิ่งของ) กรุณาตรวจสอบไฟล์ของคุณว่ามีหัวตารางที่ถูกต้อง')
    }

    const rows = lines.slice(1)

    const itemsToInsert = []
    let lineNum = 1

    for (const row of rows) {
      lineNum++
      const cols = parseCSVLine(row)
      if (cols.length < headers.length) {
        return errorResponse(`บรรทัดที่ ${lineNum}: จำนวนคอลัมน์ไม่ครบถ้วน (พบ ${cols.length} คอลัมน์, ต้องการอย่างน้อย ${headers.length} คอลัมน์)`)
      }

      const getVal = (name: string) => {
        const idx = headers.indexOf(name)
        return idx !== -1 ? normalizeForStorage(cols[idx]) : ''
      }

      const itemName = getVal('item_name')
      if (!itemName) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ชื่อสิ่งของ (item_name) ห้ามว่าง`)
      }

      const itemType = getVal('item_type').toLowerCase() || 'asset'
      if (itemType !== 'asset' && itemType !== 'material') {
        return errorResponse(`บรรทัดที่ ${lineNum}: ประเภทสิ่งของ (item_type) ต้องเป็น asset หรือ material`)
      }

      const quantity = Math.max(1, parseInt(getVal('quantity')) || 1)
      const rawUnitPrice = getVal('unit_price')
      const parsedUnitPrice = rawUnitPrice === '' ? null : Number(rawUnitPrice)
      if (
        parsedUnitPrice !== null &&
        (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)
      ) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ราคาต่อหน่วย (unit_price) ต้องเป็นตัวเลขที่ไม่ติดลบ`)
      }
      const unitPrice = parsedUnitPrice
      const status = getVal('status').toLowerCase() || 'active'

      itemsToInsert.push({
        item_name: itemName,
        item_type: itemType,
        category_name: getVal('category_name'),
        location_name: getVal('location_name'),
        unit_name: getVal('unit_name'),
        quantity,
        unit_price: unitPrice,
        status,
        asset_no: getVal('asset_no') || null,
        serial_no: getVal('serial_no') || null,
        brand: getVal('brand') || null,
        model: getVal('model') || null,
        responsible_person: getVal('responsible_person') || null,
        note: getVal('note') || null,
      })
    }

    if (itemsToInsert.length === 0) {
      return errorResponse('ไม่พบแถวข้อมูลที่สามารถนำเข้าได้')
    }

    const supabase = isPostgresBackend() ? null : await createClient()
    const { data, error } = isPostgresBackend() ? await importPostgresItems(itemsToInsert) : await supabase!.rpc('import_items_bulk_tx', {
      items_json: itemsToInsert,
      creator_id: auth.profile.id,
    })

    if (error) {
      logger.error({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id }, error)
      return errorResponse('เกิดข้อผิดพลาดในการประมวลผลฐานข้อมูล: ' + error.message)
    }

    const res = data as { ok: boolean; count?: number; error?: string }
    if (!res.ok) {
      logger.warn({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id, details: res.error })
      return errorResponse('เกิดข้อผิดพลาดขณะนำเข้าข้อมูล: ' + (res.error || 'ข้อผิดพลาดภายใน'))
    }

    // PostgreSQL records each row through database audit triggers.
    if (!isPostgresBackend()) await writeAuditLog({
      operation: 'import',
      feature: 'items',
      userId: auth.profile.id,
      targetType: 'items',
      newValues: { count: res.count },
    })

    const durationMs = timer.stop()
    const ctx = await getRequestContext(auth.profile.id)
    metrics.csvImport(res.count ?? 0)
    logger.info(withTraceContext(ctx, {
      operation: 'importItemsBulk',
      feature: 'items',
      action: 'importItemsBulk',
      userId: auth.profile.id,
      latency: durationMs,
      status: 'success',
      details: { count: res.count },
    }))

    revalidatePath('/items')
    revalidateSidebarCache()
    return successResponse(`นำเข้าพัสดุสำเร็จ ${res.count} รายการ`, { count: res.count ?? 0 })
  } catch (err) {
    return handleActionError<{ count: number }>(err, 'importItemsBulk', 'items', auth.profile.id)
  }
}

export async function getItemsForExport(params: ItemListSearchParams) {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ')
  }
  const result = await getReportItemsList(params, true)
  return result.items
}
