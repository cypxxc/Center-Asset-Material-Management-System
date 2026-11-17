import type { Cell, Workbook } from 'exceljs'
import { assertNoDuplicateMaterials } from './import-validation'
import { parseDateThaiBEToISO } from '@/lib/date'
import { templateWorkbookCSV } from './import-template'
import { materialLedgerSchema, MATERIAL_LEDGER_FIELDS } from './material-fields'

export const MATERIAL_LEDGER_CATEGORIES = ['วัสดุสำนักงาน', 'วัสดุคอมพิวเตอร์', 'วัสดุงานบ้านงานครัว', 'วัสดุโฆษณาและเผยแพร่'] as const

function text(cell: Cell): string {
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return String(cell.result ?? '')
    if ('richText' in value) return value.richText.map(part => part.text).join('')
    if ('text' in value) return String(value.text)
  }
  return String(value)
}
function number(cell: Cell, label: string): number {
  const value = Number(text(cell))
  if (!text(cell) || !Number.isFinite(value) || value < 0) throw new Error(`${label}: missing or invalid numeric value`)
  return value
}
export function materialRecordsCSV(matrix: unknown[][]): string {
  return '\uFEFF' + matrix.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n'
}

export function readMaterialLedger(workbook: Workbook, name: string, expectedCategory?: string) {
  const records = []
  const issues: Array<{ source_key: string; item_name: string; issue: string }> = []
  const summary = workbook.getWorksheet('รายการวัสดุ')
  if (!summary) throw new Error('ไม่พบชีต รายการวัสดุ กรุณาเลือกไฟล์บัญชีวัสดุต้นฉบับ')
  const fiscalYear = text(summary.getCell('A2')).match(/(?:ปีงบประมาณ|พ\.ศ\.)\D*(\d{4})/)?.[1]
  if (!fiscalYear) throw new Error('ไม่พบปีงบประมาณในบัญชีวัสดุ กรุณาใช้เทมเพลตกลางหากไฟล์มีโครงสร้างต่างออกไป')
  let balanceCol = 0, openingCol = 0, locationCol = 0
  summary.getRow(5).eachCell((cell, column) => {
    if (cell.isMerged && cell.address !== cell.master.address) return
    if (text(cell) === 'คงเหลือ') balanceCol = column
    if (text(cell) === 'ยอดคงเหลือยกมา') openingCol = column
    if (text(cell) === 'สถานที่จัดเก็บ') locationCol = column
  })
  if (!balanceCol || !openingCol) throw new Error(`Missing balance columns: ${name}`)
  const dateCell = summary.getRow(6).getCell(balanceCol)
  const dateValue = dateCell.value
  const dateText = text(dateCell).replace(/^\s*\(?\s*ณ\s*/, '').replace(/\)\s*$/, '').trim()
    .replace(/([^\d\s])(?=\d{2,4}$)/, '$1 ').replace(/\s+/g, ' ')
  const asOf = dateValue instanceof Date ? dateValue.toISOString().slice(0, 10) : parseDateThaiBEToISO(dateText)
  if (!asOf || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf) {
    throw new Error('ไม่พบวันที่ยอดคงเหลือที่ถูกต้องในบัญชีวัสดุ')
  }
  let count = 0, valueCents = 0
  for (let r = 9; r <= summary.rowCount; r++) {
    const row = summary.getRow(r)
    if (row.getCell(2).isMerged && row.getCell(2).master.address !== row.getCell(2).address) continue
    const originalName = text(row.getCell(2))
    if (!originalName.trim()) continue
    const ordinal = number(row.getCell(1), `${name}:${r} ordinal`)
    const detail = workbook.getWorksheet(String(ordinal))
    if (!detail || text(detail.getCell('E4')) !== originalName) throw new Error(`Source/detail name mismatch: ${name}:${r}`)
    const quantity = number(row.getCell(balanceCol), `${name}:${r} balance`)
    if (!Number.isInteger(quantity)) throw new Error(`Fractional stock requires unit decision: ${name}:${r}`)
    const unitPrice = number(row.getCell(balanceCol + 1), `${name}:${r} price`)
    const amount = number(row.getCell(balanceCol + 2), `${name}:${r} amount`)
    if (Math.abs(quantity * unitPrice - amount) > 0.011) throw new Error(`Source amount mismatch: ${name}:${r}`)
    if (text(detail.getCell('F9')) && number(row.getCell(openingCol), 'opening') !== number(detail.getCell('F9'), 'detail opening')) throw new Error(`Opening mismatch: ${name}:${r}`)
    const spec = text(row.getCell(3))
    const itemName = originalName
    const category = text(row.getCell(4))
    const categoryNumber = MATERIAL_LEDGER_CATEGORIES.indexOf(category as typeof MATERIAL_LEDGER_CATEGORIES[number]) + 1
    if (!category.trim() || (expectedCategory && category !== expectedCategory)) throw new Error(`หมวดในไฟล์ไม่ตรงกับบัญชีวัสดุที่รองรับ: ${category}`)
    // Preserve legacy keys while allowing categories added after the initial migration.
    const categoryKey = categoryNumber || `category-${encodeURIComponent(category.trim())}`
    const sourceKey = `[CAMMS-MATERIAL-${fiscalYear}:${categoryKey}:${ordinal}]`
    const location = locationCol ? text(row.getCell(locationCol)) : ''
    const unit = text(row.getCell(6))
    const warnings = []
    if (!text(detail.getCell('F9'))) warnings.push('ยอดยกมาในบัญชีรายตัวว่าง แม้ชีตสรุปแสดงศูนย์ ต้องยืนยันยอด')
    if (!location) warnings.push('ไม่ระบุสถานที่จัดเก็บในชีตสรุป')
    if (unit.includes('/')) warnings.push('หน่วยนับรวมหลายหน่วย: เก็บตามต้นฉบับ ไม่แปลงหน่วย')
    if (unitPrice === 0) warnings.push('ราคาเป็นศูนย์ ต้องยืนยันว่าเป็นศูนย์จริงหรือยังไม่ได้กรอก')
    if (!text(row.getCell(7)) || !text(row.getCell(8))) warnings.push('ไม่มีค่าจำนวนขั้นต่ำหรือสูงสุด')
    if (quantity > Number(text(row.getCell(7))) && text(row.getCell(7))) warnings.push('ยอดคงเหลือสูงกว่าจำนวนอย่างสูงในต้นฉบับ ต้องทบทวนเกณฑ์')
    const sourceValues = Array.from({ length: balanceCol + 2 }, (_, index) => {
      const cell = row.getCell(index + 1)
      const value = cell.value
      return value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value) ? cell.result ?? null : value
    })
    const note = JSON.stringify({ source_key: sourceKey, as_of: asOf, source_file: name, source_row: r,
      source_fields: { name: originalName, specification: sourceValues[2], commodity_code: sourceValues[4],
        minimum: sourceValues[7], maximum: sourceValues[6], unit: sourceValues[5] } })
    const optionalNumber = (column: number) => text(row.getCell(column)).trim() ? number(row.getCell(column), `${name}:${r}:${column}`) : null
    const ledger = materialLedgerSchema.parse({ specification: spec, commodity_code: String(sourceValues[4] ?? ''),
      fiscal_year: Number(fiscalYear), balance_as_of: asOf,
      minimum_quantity: optionalNumber(8), maximum_quantity: optionalNumber(7),
      opening_quantity: optionalNumber(openingCol), opening_amount: optionalNumber(openingCol + 1),
      received_quantity: optionalNumber(openingCol + 2), received_amount: optionalNumber(openingCol + 3),
      issued_quantity: optionalNumber(openingCol + 4), issued_amount: optionalNumber(openingCol + 5), balance_amount: amount })
    records.push({ item_name: itemName, item_type: 'material', qualification_status: null,
      ...ledger,
      category_name: text(row.getCell(4)), location_name: location, unit_name: unit,
      quantity, unit_price: unitPrice, status: 'active', asset_no: null, serial_no: null,
      brand: null, model: null, responsible_person: null, note, gfmis_number: null,
      budget_source: null, acquired_date: null,
      source_key: sourceKey, source_file: name, source_row: r, source_sheet: 'รายการวัสดุ',
      commodity_code: ledger.commodity_code, specification: spec, opening_quantity: number(row.getCell(openingCol), 'opening'),
      minimum: sourceValues[7], maximum: sourceValues[6], amount, source_values: sourceValues, warnings })
    warnings.forEach(issue => issues.push({ source_key: sourceKey, item_name: itemName, issue }))
    valueCents += Math.round(amount * 100)
    count++
  }
  if (!records.length) throw new Error('ไม่พบรายการวัสดุในไฟล์')
  assertNoDuplicateMaterials(records, [])
  return { records, issues, count, value: valueCents / 100, asOf }
}

export function materialLedgerCSV(records: ReturnType<typeof readMaterialLedger>['records']) {
  const headers = ['item_name','item_type','category_name','location_name','unit_name','quantity','unit_price','status','note', ...MATERIAL_LEDGER_FIELDS] as const
  return materialRecordsCSV([Array.from(headers), ...records.map(row => headers.map(key => row[key]))])
}

export function prepareMaterialWorkbook(workbook: Workbook, name: string) {
  const summary = workbook.getWorksheet('รายการวัสดุ')
  let hasOpeningBalance = false
  summary?.getRow(5).eachCell(cell => {
    if (text(cell).trim() === 'ยอดคงเหลือยกมา') hasOpeningBalance = true
  })
  if (hasOpeningBalance) {
    const ledger = readMaterialLedger(workbook, name)
    return { csv: materialLedgerCSV(ledger.records), issues: ledger.issues, asOf: ledger.asOf }
  }
  return { csv: templateWorkbookCSV(workbook, 'material'), issues: [], asOf: null }
}
