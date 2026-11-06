'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
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
import { parseDateThaiBEToISO } from '@/lib/date'

const HEADER_ALIASES: Record<string, string> = {
  // item_name
  'item_name': 'item_name',
  'ชื่อสิ่งของ': 'item_name',
  'ชื่อพัสดุ': 'item_name',
  'รายการ': 'item_name',
  'รายการครุภัณฑ์': 'item_name',
  'ชื่อ': 'item_name',

  // item_type
  'item_type': 'item_type',
  'ประเภท': 'item_type',
  'ประเภทสิ่งของ': 'item_type',

  // acquired_date
  'acquired_date': 'acquired_date',
  'วัน เดือน ปีที่รับ': 'acquired_date',
  'วันเดือนปีที่รับ': 'acquired_date',
  'วันที่รับ': 'acquired_date',
  'วันที่ได้มา': 'acquired_date',
  'วันที่รับเข้า': 'acquired_date',

  // budget_source
  'budget_source': 'budget_source',
  'รับจาก (งปม.)': 'budget_source',
  'รับจาก(งปม.)': 'budget_source',
  'รับจาก (งปม.) / แหล่งเงิน': 'budget_source',
  'รับจาก': 'budget_source',
  'งบประมาณ': 'budget_source',
  'แหล่งเงิน': 'budget_source',

  // brand / model
  'brand': 'brand',
  'ยี่ห้อ': 'brand',
  'model': 'model',
  'รุ่น': 'model',
  'ยี่ห้อ/รุ่น': 'brand_model_combined',
  'ยี่ห้อรุ่น': 'brand_model_combined',

  // unit_price
  'unit_price': 'unit_price',
  'ราคา': 'unit_price',
  'ราคาต่อหน่วย': 'unit_price',
  'มูลค่า': 'unit_price',

  // quantity
  'quantity': 'quantity',
  'จำนวน': 'quantity',

  // unit_name
  'unit_name': 'unit_name',
  'หน่วย': 'unit_name',
  'หน่วยนับ': 'unit_name',

  // asset_no
  'asset_no': 'asset_no',
  'เลขครุภัณฑ์': 'asset_no',
  'รหัสครุภัณฑ์': 'asset_no',
  'หมายเลขครุภัณฑ์': 'asset_no',

  // gfmis_number
  'gfmis_number': 'gfmis_number',
  'เลขสินทรัพย์': 'gfmis_number',
  'เลขสินทรัพย์ gfmis': 'gfmis_number',
  'เลขสินทรัพย์ (gfmis)': 'gfmis_number',
  'เลข gfmis': 'gfmis_number',
  'gfmis': 'gfmis_number',

  // serial_no
  'serial_no': 'serial_no',
  'serial number': 'serial_no',
  'serialno': 'serial_no',
  's/n': 'serial_no',
  'sn': 'serial_no',

  // responsible_person
  'responsible_person': 'responsible_person',
  'ผู้ครอบครอง': 'responsible_person',
  'ผู้รับผิดชอบ': 'responsible_person',
  'ผู้ดูแล': 'responsible_person',

  // location_name
  'location_name': 'location_name',
  'ใช้งานที่': 'location_name',
  'สถานที่': 'location_name',
  'สถานที่ติดตั้ง': 'location_name',
  'สถานที่จัดเก็บ': 'location_name',

  // category_name
  'category_name': 'category_name',
  'หมวดหมู่': 'category_name',
  'หมวด': 'category_name',
  'หมวดครุภัณฑ์': 'category_name',

  // status
  'status': 'status',
  'สถานะ': 'status',
  'สภาพพัสดุ': 'status',

  // Condition columns (from 3-check column layout in ledger)
  'ใช้งานได้': 'condition_usable',
  'ชำรุด': 'condition_damaged',
  'เสื่อมสภาพ': 'condition_deteriorated',

  // note
  'note': 'note',
  'หมายเหตุ': 'note',
}

function extractBrandModelAndSerial(rawText: string): { brandModel: string; serialNo: string | null } {
  if (!rawText) return { brandModel: '', serialNo: null }
  const snMatch = rawText.match(/(?:s\/n|sn|serial(?:\s*no)?)\s*[:\s#]\s*([A-Za-z0-9_-]+)/i)
  if (snMatch) {
    const serialNo = snMatch[1].trim()
    const cleaned = rawText
      .replace(/\(?(?:s\/n|sn|serial(?:\s*no)?)\s*[:\s#]\s*[A-Za-z0-9_-]+\)?/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return { brandModel: cleaned, serialNo }
  }
  return { brandModel: rawText.trim(), serialNo: null }
}

function parseConditionStatus(
  explicitStatus: string,
  usable: string,
  damaged: string,
  deteriorated: string
): string {
  const isMarked = (val: string) => {
    const s = val.trim().toLowerCase()
    return s === '/' || s === '✓' || s === 'x' || s === '1' || s === 'y' || s === 'yes' || s === 'true' || s === 'ชำรุด' || s === 'เสื่อมสภาพ' || s === 'ใช้งานได้'
  }

  if (isMarked(damaged)) return 'damaged'
  if (isMarked(deteriorated)) return 'inactive'
  if (isMarked(usable)) return 'active'

  const s = explicitStatus.trim().toLowerCase()
  if (!s) return 'active'
  if (s === 'ชำรุด' || s === 'damaged') return 'damaged'
  if (s === 'เสื่อมสภาพ' || s === 'ไม่ใช้งาน' || s === 'inactive') return 'inactive'
  if (s === 'รอซ่อม' || s === 'waiting_repair') return 'waiting_repair'
  if (s === 'สำรอง' || s === 'spare') return 'spare'
  if (s === 'จำหน่ายแล้ว' || s === 'disposed') return 'disposed'
  if (s === 'ใช้งานได้' || s === 'ใช้งานอยู่' || s === 'active') return 'active'
  return s
}

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
    // Find header line (allows title rows above table in official spreadsheets)
    let headerLineIdx = 0
    let mappedHeaders: string[] = []

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const rawCols = parseCSVLine(lines[i]).map((h) => normalizeForSearch(h))
      const aliases = rawCols.map(col => HEADER_ALIASES[col] || col)
      if (aliases.includes('item_name')) {
        headerLineIdx = i
        mappedHeaders = aliases
        break
      }
    }

    if (!mappedHeaders.includes('item_name')) {
      return errorResponse('ไม่พบหัวคอลัมน์ "item_name" (ชื่อสิ่งของ) กรุณาตรวจสอบไฟล์ของคุณว่ามีหัวตารางที่ถูกต้อง')
    }

    const rows = lines.slice(headerLineIdx + 1)

    const itemsToInsert = []
    let lineNum = headerLineIdx + 1

    for (const row of rows) {
      lineNum++
      const cols = parseCSVLine(row)

      // Skip empty or summary rows (e.g., 'รวมทั้งสิ้น', 'มูลค่ารวม')
      const firstCol = cols[0]?.trim() || ''
      if (firstCol.startsWith('รวม') || firstCol.startsWith('มูลค่ารวม') || firstCol.startsWith('ผู้รายงาน') || firstCol.startsWith('หมายเหตุ:')) {
        continue
      }

      if (cols.length < mappedHeaders.length) {
        return errorResponse(`บรรทัดที่ ${lineNum}: จำนวนคอลัมน์ไม่ครบถ้วน (พบ ${cols.length} คอลัมน์, ต้องการอย่างน้อย ${mappedHeaders.length} คอลัมน์)`)
      }

      const getVal = (name: string) => {
        const idx = mappedHeaders.indexOf(name)
        return idx !== -1 ? normalizeForStorage(cols[idx]) : ''
      }

      const itemName = getVal('item_name')
      if (!itemName) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ชื่อสิ่งของ (item_name) ห้ามว่าง`)
      }

      const rawItemType = getVal('item_type').toLowerCase()
      const itemType = rawItemType ? rawItemType : 'asset'
      if (itemType !== 'asset' && itemType !== 'material') {
        return errorResponse(`บรรทัดที่ ${lineNum}: ประเภทสิ่งของ (item_type) ต้องเป็น asset หรือ material`)
      }

      const quantity = Math.max(1, parseInt(getVal('quantity')) || 1)
      const rawUnitPrice = getVal('unit_price')
      const parsedUnitPrice = rawUnitPrice === '' ? null : Number(rawUnitPrice.replace(/,/g, ''))
      if (
        parsedUnitPrice !== null &&
        (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)
      ) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ราคาต่อหน่วย (unit_price) ต้องเป็นตัวเลขที่ไม่ติดลบ`)
      }
      const unitPrice = parsedUnitPrice

      // Condition status determination (supports 3-column checkmark or single status column)
      const status = parseConditionStatus(
        getVal('status'),
        getVal('condition_usable'),
        getVal('condition_damaged'),
        getVal('condition_deteriorated')
      )

      // Handle brand/model and serial number extraction
      let brand = getVal('brand') || null
      const model = getVal('model') || null
      let serialNo = getVal('serial_no') || null

      const combinedBrandModel = getVal('brand_model_combined')
      if (combinedBrandModel) {
        const extracted = extractBrandModelAndSerial(combinedBrandModel)
        if (!serialNo && extracted.serialNo) {
          serialNo = extracted.serialNo
        }
        if (!brand) {
          brand = extracted.brandModel
        }
      }

      const rawAcquiredDate = getVal('acquired_date')
      const acquiredDate = rawAcquiredDate ? parseDateThaiBEToISO(rawAcquiredDate) : null

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
        serial_no: serialNo,
        brand,
        model,
        responsible_person: getVal('responsible_person') || null,
        gfmis_number: getVal('gfmis_number') || null,
        budget_source: getVal('budget_source') || null,
        acquired_date: acquiredDate,
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
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    throw new Error(auth.error ?? 'คุณไม่มีสิทธิ์ดาวน์โหลดข้อมูลพัสดุ')
  }
  const result = await getReportItemsList(params, true)
  return result.items
}
