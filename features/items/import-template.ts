import type { Workbook, Cell } from 'exceljs'
import { STANDARD_CSV_HEADERS, HEADER_KEYWORD_MAP } from './excel-importer'
import { parseImportQuantity, assertNoDuplicateMaterials, type MaterialImportIdentity } from './import-validation'
import { parseImportCSV, encodeImportCSV } from '@/lib/import-csv'
import { MATERIAL_LEDGER_FIELDS, materialLedgerSchema } from './material-fields'
import { MATERIAL_IMPORT_COLUMNS } from './material-import-columns'

export type ImportPreviewRecord = MaterialImportIdentity & { quantity: number; unit_price: number | null }

export function populateImportTemplate(workbook: Workbook, type: 'asset' | 'material') {
  const sheet = workbook.addWorksheet('นำเข้าวัสดุ')
  const headers = type === 'material' ? MATERIAL_IMPORT_COLUMNS.map(([key]) => key) : STANDARD_CSV_HEADERS
  sheet.columns = headers.map(key => ({ header: key, key, width: key === 'item_name' || key === 'note' ? 40 : 22 }))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163B5C' } }
  sheet.addRow({ item_name: type === 'asset' ? 'โต๊ะทำงาน (ตัวอย่าง)' : 'กระดาษ A4 (ตัวอย่าง)',
    item_type: type, qualification_status: type === 'asset' ? 'qualified' : '',
    category_name: type === 'asset' ? 'ครุภัณฑ์สำนักงาน' : 'วัสดุสำนักงาน',
    unit_name: type === 'asset' ? 'ตัว' : 'รีม', quantity: type === 'asset' ? 1 : 0,
    unit_price: type === 'asset' ? 1000 : 0, status: 'active', note: 'แถวตัวอย่าง กรุณาแทนที่ด้วยข้อมูลจริง' })
  return sheet
}

function value(cell: Cell): string | number | boolean | Date | null {
  const raw = cell.value
  if (raw == null) return null
  if (typeof raw === 'object' && !(raw instanceof Date)) {
    if ('formula' in raw || 'sharedFormula' in raw) return cell.result ?? null
    if ('richText' in raw) return raw.richText.map(part => part.text).join('')
    if ('text' in raw) return raw.text
    throw new Error('ไม่สามารถอ่านค่าเซลล์ในเทมเพลตได้')
  }
  return raw
}

export function hasStandardTemplate(workbook: Workbook) {
  return workbook.worksheets[0]?.getRow(1).values && Array.from(workbook.worksheets[0].getRow(1).values as unknown[]).some(cell => cell === 'item_name')
}

function headerKey(label: string, expected?: 'asset' | 'material'): string {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, '')
  if (expected === 'material' && normalized === 'ประเภท') return 'category_name'
  const extra: Record<string, string> = {
    ...Object.fromEntries(MATERIAL_LEDGER_FIELDS.map(key => [key, key])),
    'ชื่อหรือชนิดวัสดุ': 'item_name', 'ขนาดหรือลักษณะ': 'specification', 'รหัส': 'commodity_code',
    'จำนวนอย่างสูง': 'maximum_quantity', 'จำนวนอย่างต่ำ': 'minimum_quantity',
    'ยอดยกมา(จำนวน)': 'opening_quantity', 'ยอดยกมา(จำนวนเงิน)': 'opening_amount',
    'รับ(จำนวน)': 'received_quantity', 'รับ(จำนวนเงิน)': 'received_amount',
    'จ่าย(จำนวน)': 'issued_quantity', 'จ่าย(จำนวนเงิน)': 'issued_amount',
    'คงเหลือ(จำนวนเงิน)': 'balance_amount', 'ราคา/หน่วย': 'unit_price',
    'ปีงบประมาณ': 'fiscal_year', 'วันที่ยอดคงเหลือ': 'balance_as_of',
    'ชื่อรายการ': 'item_name', 'รายการวัสดุ': 'item_name',
    'จำนวนคงเหลือ': 'quantity', 'ยอดคงเหลือ': 'quantity', 'คงเหลือ': 'quantity',
    'หมวดวัสดุ': 'category_name', 'ประเภทวัสดุ': 'category_name',
  }
  // Total amounts cannot safely be interpreted as a per-unit price.
  if (['จำนวนเงิน', 'มูลค่า'].includes(normalized)) return ''
  return extra[normalized] ?? Object.entries(HEADER_KEYWORD_MAP)
    .find(([key]) => key.toLowerCase().replace(/\s+/g, '') === normalized)?.[1] ?? ''
}

function findHeader(rows: unknown[][]): number {
  return rows.findIndex(row => row.some(cell => headerKey(String(cell ?? '')) === 'item_name'))
}

export function normalizeImportCSV(csv: string, expected?: 'asset' | 'material'): string {
  const rows = parseImportCSV(csv)
  const headerIndex = findHeader(rows)
  if (headerIndex < 0) throw new Error('ไม่พบหัวคอลัมน์ชื่อวัสดุ/ชื่อสิ่งของ (item_name) ในไฟล์')
  const rawHeaders = rows[headerIndex]
  const headers = rawHeaders.map(header => headerKey(header, expected))
  const unknown = rawHeaders.filter((_, index) => !headers[index] || !(STANDARD_CSV_HEADERS as readonly string[]).includes(headers[index]))
  if (unknown.length) throw new Error(`ไม่รู้จักหัวคอลัมน์: ${unknown.map(label => label || '(ว่าง)').join(', ')}`)
  if (new Set(headers).size !== headers.length) throw new Error('พบหัวคอลัมน์ซ้ำที่อ้างถึงข้อมูลเดียวกัน กรุณาตรวจสอบไฟล์')
  if (!headers.includes('quantity')) throw new Error('ไม่พบหัวคอลัมน์จำนวน/จำนวนคงเหลือ (quantity) ในไฟล์')
  const addType = !headers.includes('item_type') && expected !== undefined
  if (!headers.includes('item_type') && !addType) throw new Error('ไม่พบหัวคอลัมน์ประเภทสิ่งของ (item_type)')
  const normalizedRows = rows.slice(headerIndex + 1).map((row, index) => {
    if (row.length !== headers.length) throw new Error(`แถวที่ ${headerIndex + index + 2}: จำนวนคอลัมน์ไม่ตรงกับหัวตาราง`)
    return addType ? [...row, expected!] : row
  })
  return encodeImportCSV([addType ? [...headers, 'item_type'] : headers, ...normalizedRows])
}

export function templateWorkbookCSV(workbook: Workbook, expected?: 'asset' | 'material') {
  const files: string[] = []
  for (const sheet of workbook.worksheets) {
    const rows: unknown[][] = []
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i)
      rows.push(Array.from({ length: row.cellCount }, (_, column) => {
        const result = value(row.getCell(column + 1))
        return result instanceof Date ? result.toISOString().slice(0, 10) : result
      }))
    }
    const headerIndex = findHeader(rows)
    if (headerIndex < 0) continue
    const width = rows[headerIndex].length
    const table = rows.slice(headerIndex).filter(row => row.some(cell => cell !== null && String(cell).trim()))
      .map(row => Array.from({ length: Math.max(width, row.length) }, (_, column) => row[column] ?? ''))
    try { files.push(normalizeImportCSV(encodeImportCSV(table), expected)) }
    catch (error) { throw new Error(`ชีต ${sheet.name}: ${error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ'}`) }
  }
  if (!files.length) throw new Error('ไม่พบหัวตารางชื่อวัสดุ/ชื่อสิ่งของในไฟล์')
  return mergeImportCSVs(files)
}

export function readTemplateCSV(csv: string, expected: 'asset' | 'material') {
  const [headers, ...rows] = parseImportCSV(normalizeImportCSV(csv, expected))
  if (!headers?.includes('item_name') || !headers.includes('item_type') || !headers.includes('quantity')) {
    throw new Error('กรุณาใช้เทมเพลตกลางที่มี item_name, item_type และ quantity')
  }
  if (new Set(headers).size !== headers.length || headers.some(header => !(STANDARD_CSV_HEADERS as readonly string[]).includes(header))) {
    throw new Error('พบหัวคอลัมน์ซ้ำหรือคอลัมน์นอกเทมเพลตกลาง กรุณาตรวจสอบไฟล์')
  }
  const records: ImportPreviewRecord[] = []
  let valueCents = 0
  for (const [index, row] of rows.entries()) {
    if (row.length !== headers.length) throw new Error(`รายการที่ ${index + 1}: จำนวนคอลัมน์ไม่ตรงกับหัวตาราง`)
    const get = (name: string) => row[headers.indexOf(name)] ?? ''
    if (expected === 'material') materialLedgerSchema.parse(Object.fromEntries(MATERIAL_LEDGER_FIELDS.map(key => [key, get(key)])))
    if (!get('item_name').trim()) throw new Error(`รายการที่ ${index + 1}: ชื่อสิ่งของห้ามว่าง`)
    if (get('item_type').trim().toLowerCase() !== expected) throw new Error(`รายการที่ ${index + 1}: ประเภทข้อมูลไม่ตรงกับฟอร์มที่เลือก`)
    if (!get('quantity').trim()) throw new Error(`รายการที่ ${index + 1}: กรุณาระบุจำนวน`)
    const quantity = parseImportQuantity(get('quantity'), false)
    if (expected === 'asset' && quantity === 0) throw new Error('จำนวนครุภัณฑ์ต้องมากกว่า 0')
    const price = get('unit_price').trim()
    const unitPrice = price ? Number(price.replaceAll(',', '')) : null
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error('ราคาต่อหน่วยไม่ถูกต้อง')
    records.push({ item_name: get('item_name'), item_type: expected, category_name: get('category_name'),
      unit_name: get('unit_name'), location_name: get('location_name'), quantity, unit_price: unitPrice, note: get('note') || null })
    valueCents += Math.round(quantity * (unitPrice ?? 0) * 100)
  }
  if (!records.length) throw new Error('ไม่พบรายการในไฟล์')
  assertNoDuplicateMaterials(records, [])
  return { records, count: records.length, value: records.some(row => row.quantity > 0 && row.unit_price === null) ? null : valueCents / 100 }
}

export function mergeImportCSVs(files: string[]) {
  const merged: unknown[][] = [Array.from(STANDARD_CSV_HEADERS)]
  for (const csv of files) {
    const [headers, ...rows] = parseImportCSV(csv)
    for (const row of rows) merged.push(STANDARD_CSV_HEADERS.map(key => row[headers.indexOf(key)] ?? ''))
  }
  return encodeImportCSV(merged)
}

export async function downloadImportTemplate(type: 'asset' | 'material') {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  populateImportTemplate(workbook, type)
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  try {
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `portal_import_template_${type}.xlsx`
    document.body.appendChild(anchor); anchor.click(); anchor.remove()
  } finally { URL.revokeObjectURL(url) }
}
