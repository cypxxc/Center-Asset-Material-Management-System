'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { ASSET_REGISTER_FIELDS, ASSET_REGISTER_LABELS, assetRegisterSchema } from './asset-register'
import { getReportItemsList } from '@/features/reports/queries'
import { ItemListSearchParams } from './types'
import { stripBom, normalizeForStorage, normalizeForSearch } from '@/lib/unicode'
import { logger } from '@/lib/logging'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { checkRateLimit } from '@/lib/rate-limit'
import { startTimer } from '@/lib/performance'
import { handleActionError } from '@/lib/error-handler'
import { metrics } from '@/lib/metrics'
import { getRequestContext, withTraceContext } from '@/lib/tracing'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { importPostgresItems } from './postgres-actions'
import { requireEditor } from './auth-guard'
import { parseImportQuantity } from './import-validation'
import { parseImportCSV } from '@/lib/import-csv'
import { parseDateThaiBEToISO } from '@/lib/date'
import { MATERIAL_LEDGER_FIELDS, materialLedgerSchema } from './material-fields'

const HEADER_ALIASES: Record<string, string> = {
  ...Object.fromEntries(ASSET_REGISTER_FIELDS.map(key => [normalizeForSearch(ASSET_REGISTER_LABELS[key]), key])),
  'ลำดับ': 'register_sequence',
  'ค่าเสื่อมราคาสะสม': 'register_accumulated_depreciation',
  'มูลค่าตามบัญชี': 'register_book_value',
  // item_name
  'item_name': 'item_name',
  'ชื่อสิ่งของ': 'item_name',
  'ชื่อวัสดุ': 'item_name',
  'ชื่อพัสดุ': 'item_name',
  'รายการ': 'item_name',
  'รายการครุภัณฑ์': 'item_name',
  'ชื่อ': 'item_name',

  // item_type
  'item_type': 'item_type',
  'qualification_status': 'qualification_status',
  'สถานะตามเกณฑ์': 'qualification_status',
  'สถานะตามเกณฑ์ครุภัณฑ์': 'qualification_status',
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
  'จำนวนเงิน': 'unit_price',

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
  'ทะเบียนกำหนดใหม่ (เขต 7)': 'asset_no',
  'ทะเบียนกำหนดใหม่': 'asset_no',

  // gfmis_number
  'gfmis_number': 'gfmis_number',
  'เลขสินทรัพย์': 'gfmis_number',
  'เลขสินทรัพย์ gfmis': 'gfmis_number',
  'เลขสินทรัพย์ (gfmis)': 'gfmis_number',
  'เลข gfmis': 'gfmis_number',
  'gfmis': 'gfmis_number',
  'รหัสสินทรัพย์ gf': 'gfmis_number',
  'รหัสสินทรัพย์': 'gfmis_number',

  // serial_no
  'serial_no': 'serial_no',
  'serial number': 'serial_no',
  'serialno': 'serial_no',
  's/n': 'serial_no',
  'sn': 'serial_no',

  // responsible_person
  'responsible_person': 'responsible_person',
  'ผู้ครอบครอง': 'responsible_person',
  '(ผู้ครอบครอง)': 'responsible_person',
  'ผู้รับผิดชอบ': 'responsible_person',
  'ผู้ดูแล': 'responsible_person',

  // location_name
  'location_name': 'location_name',
  'ใช้งานที่': 'location_name',
  'ใช้ประจำที่': 'location_name',
  'สถานที่': 'location_name',
  'สถานที่ใช้งาน': 'location_name',
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
  'สภาพวัสดุ': 'status',
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

const QUALIFIED_VALUES = new Set(['qualified', 'ตามเกณฑ์', 'ครุภัณฑ์ตามเกณฑ์'])
const BELOW_THRESHOLD_VALUES = new Set(['below_threshold', 'ต่ำกว่าเกณฑ์', 'ต่ำกว่าเกณฑ์ (ต)', 'ต่ำกว่าเกณฑ์ (ต.)', 'ครุภัณฑ์ต่ำกว่าเกณฑ์', 'ครุภัณฑ์ต่ำกว่าเกณฑ์ (ต.)'])
const MARKED_CONDITION_VALUES = new Set(['/', '✓', 'x', '1', 'y', 'yes', 'true', 'ชำรุด', 'เสื่อมสภาพ', 'ใช้งานได้'])
const SUBHEADER_ITEM_NAMES = new Set(['รายการ', 'รายการครุภัณฑ์', 'ชื่อสิ่งของ', 'ยี่ห้อ/รุ่น'])
const SUBHEADER_PRICE_NAMES = new Set(['ราคา', 'จำนวนเงิน', 'ราคาต่อหน่วย'])

function parseConditionStatus(
  explicitStatus: string,
  usable: string,
  damaged: string,
  deteriorated: string
): string {
  const isMarked = (val: string) => MARKED_CONDITION_VALUES.has(val.trim().toLowerCase())

  if (isMarked(damaged)) return 'damaged'
  if (isMarked(deteriorated)) return 'inactive'
  if (isMarked(usable)) return 'active'

  const s = explicitStatus.trim().toLowerCase()
  if (!s) return 'active'
  if (s === 'ชำรุด' || s === 'damaged') return 'damaged'
  if (s === 'เสื่อมสภาพ' || s === 'ไม่ใช้งาน' || s === 'inactive' || s === 'deteriorated') return 'inactive'
  if (s === 'รอซ่อม' || s === 'waiting_repair') return 'damaged'
  if (s === 'สำรอง' || s === 'spare') return 'active'
  if (s === 'จำหน่ายแล้ว' || s === 'disposed') return 'inactive'
  if (s === 'ใช้งานได้' || s === 'ใช้งานอยู่' || s === 'active') return 'active'
  return s
}

function revalidateSidebarCache() {
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidatePath('/', 'layout')
}

export async function importItemsBulk(csvContent: string, expectedType?: 'asset' | 'material'): Promise<ActionResponse<{ count: number }>> {
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
  let lines: string[][]
  try { lines = parseImportCSV(cleanContent) } catch (error) { return errorResponse(error instanceof Error ? error.message : 'Invalid CSV') }
  if (lines.length <= 1) {
    return errorResponse('ไม่พบข้อมูลในไฟล์ CSV')
  }

  // 3. Rows count check (2,500 data rows max)
  if (lines.length > 2501) {
    return errorResponse('จำนวนแถวข้อมูลเกินขีดจำกัด (สูงสุด 2,500 แถวต่อการนำเข้าหนึ่งครั้ง)')
  }

  try {
    // Find header line (allows title rows above table in official spreadsheets)
    let headerLineIdx = 0
    let mappedHeaders: string[] = []

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const rawCols = lines[i].map((h) => normalizeForSearch(h))
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

    const headerIndex = new Map<string, number>()
    const headerAllIndices = new Map<string, number[]>()
    for (let i = 0; i < mappedHeaders.length; i++) {
      const h = mappedHeaders[i]
      if (!headerIndex.has(h)) headerIndex.set(h, i)
      const list = headerAllIndices.get(h)
      if (list) list.push(i)
      else headerAllIndices.set(h, [i])
    }

    const itemsToInsert = []
    let lineNum = headerLineIdx + 1

    for (const row of rows) {
      lineNum++
      const cols = row

      // Skip completely empty lines
      if (cols.every((c) => !c.trim())) {
        continue
      }

      // Skip empty or summary rows (e.g., 'รวมทั้งสิ้น', 'มูลค่ารวม')
      const firstCol = cols[0]?.trim() || ''
      if (
        firstCol.startsWith('รวม') ||
        firstCol.startsWith('มูลค่ารวม') ||
        firstCol.startsWith('ผู้รายงาน') ||
        firstCol.startsWith('หมายเหตุ') ||
        firstCol.startsWith('ส่วนราชการ') ||
        firstCol.startsWith('หมวดครุภัณฑ์')
      ) {
        continue
      }

      if (cols.length < mappedHeaders.length) {
        return errorResponse(`บรรทัดที่ ${lineNum}: จำนวนคอลัมน์ไม่ครบถ้วน (พบ ${cols.length} คอลัมน์, ต้องการอย่างน้อย ${mappedHeaders.length} คอลัมน์)`)
      }

      const normalizedCache = new Map<number, string>()
      const normCol = (idx: number) => {
        let val = normalizedCache.get(idx)
        if (val === undefined) {
          val = normalizeForStorage(cols[idx])
          normalizedCache.set(idx, val)
        }
        return val
      }

      const getVal = (name: string) => {
        const idx = headerIndex.get(name)
        return idx !== undefined ? normCol(idx) : ''
      }

      const getAllVals = (name: string): string[] => {
        const indices = headerAllIndices.get(name)
        if (!indices) return []
        const vals: string[] = []
        for (const idx of indices) {
          if (cols[idx] !== undefined) {
            const v = normCol(idx)
            if (v) vals.push(v)
          }
        }
        return vals
      }

      const itemName = getVal('item_name')
      const rawUnitPrice = getVal('unit_price')

      // Detect and skip subheader rows (e.g., Row 8 in 2-tier official headers)
      if (SUBHEADER_ITEM_NAMES.has(itemName) || SUBHEADER_PRICE_NAMES.has(rawUnitPrice)) {
        continue
      }

      if (!itemName) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ชื่อสิ่งของ (item_name) ห้ามว่าง`)
      }

      const rawItemType = getVal('item_type').toLowerCase()
      const itemType = rawItemType ? rawItemType : 'asset'
      if (itemType !== 'asset' && itemType !== 'material') {
        return errorResponse(`บรรทัดที่ ${lineNum}: ประเภทสิ่งของ (item_type) ต้องเป็น asset หรือ material`)
      }
      if (expectedType && itemType !== expectedType) return errorResponse(`บรรทัดที่ ${lineNum}: ประเภทข้อมูลไม่ตรงกับฟอร์มนำเข้าที่เลือก`)

      const rawQualification = getVal('qualification_status').trim().toLowerCase()
      const qualificationStatus: 'qualified' | 'below_threshold' | null = QUALIFIED_VALUES.has(rawQualification)
        ? 'qualified'
        : BELOW_THRESHOLD_VALUES.has(rawQualification)
          ? 'below_threshold'
          : null
      if (rawQualification && qualificationStatus === null) {
        return errorResponse(`บรรทัดที่ ${lineNum}: qualification_status ต้องเป็น qualified หรือ below_threshold`)
      }
      if (itemType === 'asset' && qualificationStatus === null) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ครุภัณฑ์ต้องระบุสถานะตามเกณฑ์เป็น “ตามเกณฑ์” หรือ “ต่ำกว่าเกณฑ์”`)
      }

      const rawQuantity = getVal('quantity')
      let quantity: number
      try { quantity = parseImportQuantity(rawQuantity, itemType === 'asset') }
      catch { return errorResponse(`บรรทัดที่ ${lineNum}: จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป และไม่เกินขอบเขตที่ระบบรองรับ`) }

      let unitPrice: number | null = null
      if (rawUnitPrice && rawUnitPrice !== '-' && rawUnitPrice !== 'ไม่มี' && rawUnitPrice !== 'ไม่ระบุ' && rawUnitPrice.toLowerCase() !== 'n/a') {
        const cleanedPrice = rawUnitPrice.replace(/,/g, '').trim()
        const parsed = Number(cleanedPrice)
        if (!Number.isFinite(parsed) || parsed < 0) {
          return errorResponse(`บรรทัดที่ ${lineNum}: ราคาต่อหน่วย (unit_price) ต้องเป็นตัวเลขที่ไม่ติดลบ`)
        }
        unitPrice = parsed
      }

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

      // Merge asset_no columns if multiple exist (e.g. prefix in col 8 and number in col 9)
      const assetVals = getAllVals('asset_no')
      let assetNo: string | null = null
      if (assetVals.length === 1) {
        assetNo = assetVals[0]
      } else if (assetVals.length > 1) {
        const uniqueParts = [...new Set(assetVals.filter(Boolean))]
        assetNo = uniqueParts.join(' ').trim() || null
      }

      const rawAcquiredDate = getVal('acquired_date')
      const acquiredDate = rawAcquiredDate ? parseDateThaiBEToISO(rawAcquiredDate) : null

      itemsToInsert.push({
        ...(itemType === 'asset' ? assetRegisterSchema.parse(Object.fromEntries(ASSET_REGISTER_FIELDS.map(key => [key, getVal(key)]))) : {}),
        ledger: itemType === 'material' ? materialLedgerSchema.parse(Object.fromEntries(MATERIAL_LEDGER_FIELDS.map(key => [key, getVal(key)]))) : undefined,
        item_name: itemName,
        item_type: itemType,
        qualification_status: qualificationStatus,
        category_name: getVal('category_name'),
        location_name: getVal('location_name'),
        unit_name: getVal('unit_name'),
        quantity,
        unit_price: unitPrice,
        status,
        asset_no: assetNo,
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

    const { data, error } = await importPostgresItems(itemsToInsert)

    if (error) {
      logger.error({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id }, error)
      const msg = error.message.includes('ซ้ำ') || error.message.includes('แถวที่')
        ? error.message
        : 'เกิดข้อผิดพลาดในการประมวลผลฐานข้อมูล: ' + error.message
      return errorResponse(msg)
    }

    const res = data as { ok: boolean; count?: number; error?: string }
    if (!res.ok) {
      logger.warn({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id, details: res.error })
      return errorResponse('เกิดข้อผิดพลาดขณะนำเข้าข้อมูล: ' + (res.error || 'ข้อผิดพลาดภายใน'))
    }

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
    return successResponse(`นำเข้าวัสดุสำเร็จ ${res.count} รายการ`, { count: res.count ?? 0 })
  } catch (err) {
    return handleActionError<{ count: number }>(err, 'importItemsBulk', 'items', auth.profile.id)
  }
}

export async function getItemsForExport(params: ItemListSearchParams) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    throw new Error(auth.error ?? 'คุณไม่มีสิทธิ์ดาวน์โหลดข้อมูลวัสดุ')
  }
  const result = await getReportItemsList(params, true)
  return result.items
}
