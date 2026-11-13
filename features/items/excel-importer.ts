import type { Workbook } from 'exceljs'
import { getSheetQualificationStatus } from './qualification-mapping-core'

export const HEADER_KEYWORD_MAP: Record<string, string> = {
  'item_name': 'item_name',
  'ชื่อสิ่งของ': 'item_name',
  'ชื่อพัสดุ': 'item_name',
  'รายการ': 'item_name',
  'รายการครุภัณฑ์': 'item_name',
  'ชื่อ': 'item_name',
  'item_type': 'item_type',
  'ประเภท': 'item_type',
  'ประเภทสิ่งของ': 'item_type',
  'qualification_status': 'qualification_status',
  'สถานะตามเกณฑ์': 'qualification_status',
  'สถานะตามเกณฑ์ครุภัณฑ์': 'qualification_status',
  'acquired_date': 'acquired_date',
  'วันเดือนปีที่รับ': 'acquired_date',
  'วัน เดือน ปี ที่ได้มา': 'acquired_date',
  'วันที่รับ': 'acquired_date',
  'วันที่ได้มา': 'acquired_date',
  'budget_source': 'budget_source',
  'รับจาก(งปม.)': 'budget_source',
  'รับจาก (งปม.)': 'budget_source',
  'รับจาก': 'budget_source',
  'งบประมาณ': 'budget_source',
  'แหล่งเงิน': 'budget_source',
  'brand': 'brand',
  'ยี่ห้อ': 'brand',
  'model': 'model',
  'รุ่น': 'model',
  'ยี่ห้อ/รุ่น': 'brand_model_combined',
  'ยี่ห้อรุ่น': 'brand_model_combined',
  'unit_price': 'unit_price',
  'ราคา': 'unit_price',
  'ราคาต่อหน่วย': 'unit_price',
  'จำนวนเงิน': 'unit_price',
  'มูลค่า': 'unit_price',
  'quantity': 'quantity',
  'จำนวน': 'quantity',
  'unit_name': 'unit_name',
  'หน่วย': 'unit_name',
  'หน่วยนับ': 'unit_name',
  'asset_no': 'asset_no',
  'เลขครุภัณฑ์': 'asset_no',
  'รหัสครุภัณฑ์': 'asset_no',
  'หมายเลขครุภัณฑ์': 'asset_no',
  'ทะเบียนกำหนดใหม่ (เขต 7)': 'asset_no',
  'ทะเบียนกำหนดใหม่': 'asset_no',
  'gfmis_number': 'gfmis_number',
  'รหัสสินทรัพย์ gf': 'gfmis_number',
  'รหัสสินทรัพย์': 'gfmis_number',
  'เลขสินทรัพย์': 'gfmis_number',
  'เลขสินทรัพย์ gfmis': 'gfmis_number',
  'เลข gfmis': 'gfmis_number',
  'serial_no': 'serial_no',
  's/n': 'serial_no',
  'sn': 'serial_no',
  'serial number': 'serial_no',
  'responsible_person': 'responsible_person',
  'ผู้ครอบครอง': 'responsible_person',
  '(ผู้ครอบครอง)': 'responsible_person',
  'ผู้รับผิดชอบ': 'responsible_person',
  'ผู้ดูแล': 'responsible_person',
  'location_name': 'location_name',
  'สถานที่ใช้งาน': 'location_name',
  'ใช้ประจำที่': 'location_name',
  'ใช้งานที่': 'location_name',
  'สถานที่': 'location_name',
  'สถานที่ติดตั้ง': 'location_name',
  'สถานที่จัดเก็บ': 'location_name',
  'category_name': 'category_name',
  'หมวดหมู่': 'category_name',
  'หมวด': 'category_name',
  'หมวดครุภัณฑ์': 'category_name',
  'status': 'status',
  'สถานะ': 'status',
  'สภาพพัสดุ': 'status',
  'ใช้งานได้': 'condition_usable',
  'ชำรุด': 'condition_damaged',
  'เสื่อมสภาพ': 'condition_deteriorated',
  'note': 'note',
  'หมายเหตุ': 'note',
}

export const STANDARD_CSV_HEADERS = [
  'item_name',
  'item_type',
  'qualification_status',
  'category_name',
  'location_name',
  'unit_name',
  'quantity',
  'unit_price',
  'status',
  'asset_no',
  'serial_no',
  'brand',
  'model',
  'responsible_person',
  'gfmis_number',
  'budget_source',
  'acquired_date',
  'note',
] as const

export function convertExcelToStandardCSV(workbook: Workbook): string {
  const csvLines: string[] = [STANDARD_CSV_HEADERS.join(',')]
  const assetOccurrences = new Map<string, number>()

  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount === 0) continue

    const headingTexts: string[] = []
    for (let r = 1; r <= Math.min(sheet.rowCount, 6); r++) {
      sheet.getRow(r).eachCell((cell) => {
        // ExcelJS cannot read .text on a merged cell whose master is empty.
        if (cell.value == null) return
        headingTexts.push(cell.text || String(cell.value))
      })
    }
    const sheetQualificationStatus = getSheetQualificationStatus(sheet.name, headingTexts)

    // Determine category from sheet title or top banner rows
    let sheetCategory = sheet.name.replace(/^[\d\s.]+|(?:\s*\(.*?\))/g, '').trim()
    for (let r = 1; r <= Math.min(sheet.rowCount, 6); r++) {
      const row = sheet.getRow(r)
      row.eachCell((c) => {
        const text = String(c.value || '').trim()
        const match = text.match(/หมวดครุภัณฑ์\s+([^\n\r(]+)/)
        if (match) sheetCategory = match[1].trim()
      })
    }

    let headerRowNumber = 0
    const colMapping = new Map<number, string>()

    for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
      const testRow = sheet.getRow(r)
      let foundItemName = false
      testRow.eachCell((cell) => {
        const val = String(cell.value || '').trim()
        const mapped = HEADER_KEYWORD_MAP[val] || HEADER_KEYWORD_MAP[val.toLowerCase()]
        if (mapped === 'item_name') foundItemName = true
      })
      if (foundItemName) {
        headerRowNumber = r
        testRow.eachCell((cell, colNumber) => {
          const val = String(cell.value || '').trim()
          const mapped = HEADER_KEYWORD_MAP[val] || HEADER_KEYWORD_MAP[val.toLowerCase()]
          if (mapped) colMapping.set(colNumber, mapped)
        })
        break
      }
    }

    if (!headerRowNumber) continue

    // Detect and map 2-tier subheaders (e.g. Row 8 in official ledgers)
    let startRow = headerRowNumber + 1
    if (headerRowNumber < sheet.rowCount) {
      const nextRow = sheet.getRow(headerRowNumber + 1)
      const conditionAliases = ['condition_usable', 'condition_damaged', 'condition_deteriorated']
      const subheaderConditions = new Set<string>()
      nextRow.eachCell((cell) => {
        const val = String(cell.value || '').trim()
        const mapped = HEADER_KEYWORD_MAP[val] || HEADER_KEYWORD_MAP[val.toLowerCase()]
        if (conditionAliases.includes(mapped)) subheaderConditions.add(mapped)
      })
      let isSubheader = false
      nextRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim()
        const mapped = HEADER_KEYWORD_MAP[val] || HEADER_KEYWORD_MAP[val.toLowerCase()]
        // A condition value in an already mapped status column is data,
        // not a second header row (e.g. the first item is "ชำรุด").
        const replacesConditionGroup = subheaderConditions.size >= 2 &&
          colMapping.get(colNumber) === 'status' && conditionAliases.includes(mapped)
        if (mapped && (!colMapping.has(colNumber) || replacesConditionGroup)) {
          colMapping.set(colNumber, mapped)
          if (['condition_usable', 'condition_damaged', 'condition_deteriorated', 'unit_price', 'acquired_date'].includes(mapped)) {
            isSubheader = true
          }
        }
      })
      if (isSubheader) startRow = headerRowNumber + 2
    }

    for (let r = startRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const c1 = row.getCell(1).value
      const isSeq = typeof c1 === 'number' || (typeof c1 === 'string' && /^\d+$/.test(c1.trim()))
      if (c1 !== null && c1 !== undefined && !isSeq) {
        const c1Str = String(c1).trim()
        if (c1Str.startsWith('รวม') || c1Str.startsWith('ผู้รายงาน') || c1Str.startsWith('หมายเหตุ') || c1Str.includes('ตัวอย่าง')) {
          continue
        }
      }

      const valuesByAlias = new Map<string, string[]>()
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const alias = colMapping.get(colNumber)
        if (alias) {
          let cellStr = ''
          if (cell.value instanceof Date) {
            let yr = cell.value.getUTCFullYear()
            const mo = String(cell.value.getUTCMonth() + 1).padStart(2, '0')
            const dy = String(cell.value.getUTCDate()).padStart(2, '0')
            if (yr >= 1950 && yr <= 1999) yr = (yr - 1900 + 2500) - 543
            else if (yr > 2400) yr -= 543
            cellStr = `${yr}-${mo}-${dy}`
          } else if (cell.value && typeof cell.value === 'object') {
            // @ts-expect-error - ExcelJS formula object handling
            cellStr = String(cell.value.result || cell.value.text || '').trim()
          } else {
            cellStr = String(cell.value || '').trim()
          }
          if (!valuesByAlias.has(alias)) valuesByAlias.set(alias, [])
          valuesByAlias.get(alias)!.push(cellStr)
        }
      })

      const itemNames = valuesByAlias.get('item_name') || []
      const itemName = itemNames[0] || ''
      if (
        !itemName ||
        itemName === 'รายการ' ||
        itemName === 'รายการครุภัณฑ์' ||
        itemName === 'ชื่อสิ่งของ' ||
        itemName === 'ยี่ห้อ/รุ่น' ||
        itemName.startsWith('รวม')
      ) {
        continue
      }

      // Check subheader price words
      const prices = valuesByAlias.get('unit_price') || []
      if (prices.some((p) => p === 'ราคา' || p === 'จำนวนเงิน' || p === 'ราคาต่อหน่วย')) continue

      if (!isSeq && sheet.name.includes('สำนักงาน') && r > 20) {
        continue
      }

      const getSingle = (k: string) => (valuesByAlias.get(k) || [])[0] || ''
      const assetVals = valuesByAlias.get('asset_no') || []
      let assetNo = [...new Set(assetVals.filter(Boolean))].join(' ').trim()
      if (assetNo) {
        const count = assetOccurrences.get(assetNo) || 0
        assetOccurrences.set(assetNo, count + 1)
        if (count > 0) {
          if (itemName.includes('จอ') || (getSingle('brand_model_combined') || '').includes('จอ')) {
            assetNo = `${assetNo} (จอ)`
          } else {
            assetNo = `${assetNo} (ชิ้นที่ ${count + 1})`
          }
        }
      }
      const rawPrice = getSingle('unit_price')
      const unitPrice = rawPrice === '-' || rawPrice === 'ไม่มี' || !rawPrice ? '' : rawPrice.replace(/,/g, '')

      const rawDate = getSingle('acquired_date')
      let unitName = getSingle('unit_name')
      if (unitName === 'ตว') unitName = 'ตัว'
      if (!unitName) {
        if (sheetCategory.includes('ยานพาหนะ')) unitName = 'คัน'
        else if (sheetCategory.includes('การแพทย์')) unitName = 'เครื่อง'
        else unitName = 'ชุด'
      }

      // Condition status determination
      let status = 'active'
      const usable = getSingle('condition_usable')
      const damaged = getSingle('condition_damaged')
      const deteriorated = getSingle('condition_deteriorated')
      const isMarked = (val: string) => {
        const s = val.trim().toLowerCase()
        return s === '/' || s === '✓' || s === '1' || s === 'true' || s === 'x' || s === 'yes' || s === 'ใช้ได้' || s === 'ปกติ'
      }
      if (isMarked(damaged)) status = 'damaged'
      else if (isMarked(deteriorated)) status = 'inactive'
      else if (isMarked(usable)) status = 'active'
      else {
        const exp = getSingle('status').trim().toLowerCase()
        if (exp.includes('ชำรุด') || exp.includes('รอซ่อม') || exp === 'damaged' || exp === 'waiting_repair') status = 'damaged'
        else if (exp.includes('เสื่อม') || exp === 'inactive' || exp === 'deteriorated' || exp === 'ไม่ใช้งาน') status = 'inactive'
        else if (exp.includes('จำหน่าย') || exp.includes('สูญหาย') || exp === 'disposed') status = 'inactive'
      }

      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`

      const declaredItemType = getSingle('item_type').trim().toLowerCase()
      const itemType = declaredItemType === 'material' ? 'material' : 'asset'
      const qualificationStatus = getSingle('qualification_status').trim() || sheetQualificationStatus || ''

      const rowData = [
        esc(itemName),
        esc(itemType),
        esc(qualificationStatus),
        esc(getSingle('category_name') || sheetCategory),
        esc(getSingle('location_name')),
        esc(unitName),
        '1',
        esc(unitPrice),
        esc(status),
        esc(assetNo),
        esc(getSingle('serial_no')),
        esc(getSingle('brand_model_combined') || getSingle('brand')),
        esc(getSingle('model')),
        esc(getSingle('responsible_person')),
        esc(getSingle('gfmis_number')),
        esc(getSingle('budget_source')),
        esc(rawDate),
        esc(getSingle('note')),
      ]
      csvLines.push(rowData.join(','))
    }
  }

  return csvLines.join('\n')
}
