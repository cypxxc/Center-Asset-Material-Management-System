import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {
  buildReportExcelWorkbook,
  generateReportExcel,
  REPORT_EXCEL_HEADERS,
} from '../../lib/reports-excel-generator'
import { ReportItemRow } from '../../features/reports/queries'

const mockReportItems: ReportItemRow[] = [
  {
    id: 'item-1',
    item_name: 'โต๊ะทำงานผู้บริหารไม้สัก ขนาดใหญ่พิเศษ 2.4 เมตร',
    item_type: 'asset',
    quantity: 2,
    unit_price: 15500.5,
    asset_no: 'ASSET-2026-001',
    serial_no: 'SN-DESK-999',
    brand: 'Modernform',
    model: 'Executive Plus',
    responsible_person: 'นายสมชาย ใจดี',
    status: 'active',
    updated_at: '2026-08-10T10:00:00.000Z',
    category: { id: 'cat-1', name: 'เฟอร์นิเจอร์' },
    unit: { id: 'unit-1', name: 'ตัว' },
    location: { id: 'loc-1', name: 'ห้องประชุมใหญ่ ชั้น 4' },
  },
  {
    id: 'item-2',
    item_name: 'กระดาษ A4 Double A 80 แกรม',
    item_type: 'material',
    quantity: 50,
    unit_price: 125,
    asset_no: null,
    serial_no: null,
    brand: 'Double A',
    model: '80gsm',
    responsible_person: 'นางสาวสมศรี รักงาน',
    status: 'active',
    updated_at: '2026-08-11T11:00:00.000Z',
    category: { id: 'cat-2', name: 'วัสดุสำนักงาน' },
    unit: { id: 'unit-2', name: 'รีม' },
    location: { id: 'loc-2', name: 'ห้องพัสดุกลาง' },
  },
]

test('Excel workbook contains correct headers, metadata, and dark navy header row styling', async () => {
  const workbook = await buildReportExcelWorkbook(mockReportItems, {
    filterSummary: 'ประเภท: ครุภัณฑ์',
    totalQuantity: 52,
    totalValue: 37251,
  })

  const worksheet = workbook.getWorksheet(1)
  assert.ok(worksheet, 'Worksheet should exist')

  // Find header row (row 5)
  const headerRow = worksheet.getRow(5)
  const rowValues = (headerRow.values as unknown[])
    .slice(1) // ExcelJS values array is 1-indexed (index 0 is undefined/empty)
    .map((v) => String(v))

  assert.deepEqual(rowValues, [...REPORT_EXCEL_HEADERS])

  // Check header styling: Dark navy fill (#1E293B -> FF1E293B), white bold text, center alignment, thin border
  headerRow.eachCell((cell) => {
    assert.equal(cell.font?.bold, true, 'Header text must be bold')
    assert.equal(cell.font?.color?.argb?.toUpperCase(), 'FFFFFFFF', 'Header text must be white')
    assert.equal(cell.fill?.type, 'pattern')
    if (cell.fill?.type === 'pattern') {
      assert.equal(
        cell.fill.fgColor?.argb?.toUpperCase(),
        'FF1E293B',
        'Header fill must be dark navy #1E293B'
      )
    }
    assert.equal(cell.alignment?.horizontal, 'center', 'Header cell should be center aligned')
    assert.ok(cell.border?.top?.style, 'Header cell must have top border')
    assert.ok(cell.border?.bottom?.style, 'Header cell must have bottom border')
  })
})

test('Excel data rows have appropriate number formatting masks and values', async () => {
  const workbook = await buildReportExcelWorkbook(mockReportItems, {
    filterSummary: 'ทั้งหมด',
  })

  const worksheet = workbook.getWorksheet(1)
  assert.ok(worksheet)

  // Data row 1 is row 6
  const row1 = worksheet.getRow(6)
  assert.equal(row1.getCell(1).value, 1) // ลำดับ
  assert.equal(row1.getCell(2).value, 'โต๊ะทำงานผู้บริหารไม้สัก ขนาดใหญ่พิเศษ 2.4 เมตร') // ชื่อ
  assert.equal(row1.getCell(3).value, 'ครุภัณฑ์') // ประเภท
  assert.equal(row1.getCell(4).value, 'เฟอร์นิเจอร์') // หมวดหมู่
  assert.equal(row1.getCell(5).value, 'ห้องประชุมใหญ่ ชั้น 4') // สถานที่
  assert.equal(row1.getCell(6).value, 2) // จำนวน
  assert.equal(row1.getCell(6).numFmt, '#,##0', 'Quantity numFmt must be #,##0')
  assert.equal(row1.getCell(7).value, 'ตัว') // หน่วย
  assert.equal(row1.getCell(8).value, 15500.5) // ราคา/หน่วย
  assert.equal(row1.getCell(8).numFmt, '#,##0.00', 'Unit price numFmt must be #,##0.00')
  assert.equal(row1.getCell(9).value, 31001) // ราคารวม
  assert.equal(row1.getCell(9).numFmt, '#,##0.00', 'Total row price numFmt must be #,##0.00')
  assert.equal(row1.getCell(10).value, 'ASSET-2026-001')
  assert.equal(row1.getCell(11).value, 'SN-DESK-999')
  assert.equal(row1.getCell(12).value, 'Modernform')
  assert.equal(row1.getCell(13).value, 'Executive Plus')
  assert.equal(row1.getCell(14).value, 'นายสมชาย ใจดี')
  assert.equal(row1.getCell(15).value, 'ใช้งานอยู่')
})

test('Excel summary row includes totals with bold styling and formatting', async () => {
  const workbook = await buildReportExcelWorkbook(mockReportItems, {
    filterSummary: 'ทั้งหมด',
    totalQuantity: 52,
    totalValue: 37251,
  })

  const worksheet = workbook.getWorksheet(1)
  assert.ok(worksheet)

  // Summary row is row 8 (5 header + 2 data + 1 summary)
  const summaryRow = worksheet.getRow(8)
  assert.equal(summaryRow.getCell(1).value, 'รวมทั้งสิ้น')
  assert.equal(summaryRow.getCell(6).value, 52)
  assert.equal(summaryRow.getCell(6).numFmt, '#,##0')
  assert.equal(summaryRow.getCell(9).value, 37251)
  assert.equal(summaryRow.getCell(9).numFmt, '#,##0.00')

  assert.equal(summaryRow.font?.bold, true, 'Summary row font should be bold')
  assert.equal(summaryRow.getCell(9).border?.bottom?.style, 'double', 'Summary row should have double bottom border')
})

test('Excel columns have auto-fit widths based on content', async () => {
  const workbook = await buildReportExcelWorkbook(mockReportItems)
  const worksheet = workbook.getWorksheet(1)
  assert.ok(worksheet)

  // Column 2 is 'ชื่อสิ่งของ' with a long name (39+ chars)
  const col2 = worksheet.getColumn(2)
  assert.ok(col2.width && col2.width >= 40, `Column 2 width (${col2.width}) should accommodate long item names`)

  // Column 1 is 'ลำดับ'
  const col1 = worksheet.getColumn(1)
  assert.ok(col1.width && col1.width >= 8, `Column 1 width should be at least minimum width`)
})

test('generateReportExcel returns binary buffer that can be re-read as valid Excel workbook', async () => {
  const buffer = await generateReportExcel(mockReportItems, {
    filterSummary: 'ทั้งหมด',
    totalQuantity: 52,
    totalValue: 37251,
  })

  assert.ok(buffer, 'Buffer should be produced')
  const loadedWorkbook = new ExcelJS.Workbook()
  await loadedWorkbook.xlsx.load(buffer as ExcelJS.Buffer)

  const worksheet = loadedWorkbook.getWorksheet(1)
  assert.ok(worksheet)
  assert.equal(worksheet.rowCount, 8)
})
