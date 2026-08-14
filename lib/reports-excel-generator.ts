import ExcelJS from 'exceljs'
import { ReportItemRow } from '@/features/reports/queries'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { formatDate } from '@/lib/date'

export interface ReportExcelOptions {
  filterSummary?: string
  totalQuantity?: number
  totalValue?: number
}

export const REPORT_EXCEL_HEADERS = [
  'ลำดับ',
  'ชื่อสิ่งของ',
  'ประเภท',
  'หมวดหมู่',
  'สถานที่',
  'จำนวน',
  'หน่วยนับ',
  'ราคาต่อหน่วย (บาท)',
  'ราคารวม (บาท)',
  'เลขครุภัณฑ์',
  'Serial Number',
  'ยี่ห้อ',
  'รุ่น',
  'ผู้รับผิดชอบ',
  'สถานะ',
] as const

export async function buildReportExcelWorkbook(
  items: ReportItemRow[],
  options?: ReportExcelOptions | string,
  legacyTotalQty?: number,
  legacyTotalVal?: number
): Promise<ExcelJS.Workbook> {
  let filterSummary = 'ทั้งหมด'
  let totalQuantity: number | undefined
  let totalValue: number | undefined

  if (typeof options === 'string') {
    filterSummary = options
    totalQuantity = legacyTotalQty
    totalValue = legacyTotalVal
  } else if (options && typeof options === 'object') {
    filterSummary = options.filterSummary ?? 'ทั้งหมด'
    totalQuantity = options.totalQuantity
    totalValue = options.totalValue
  }

  const computedTotalQty =
    totalQuantity ?? items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const computedTotalVal =
    totalValue ??
    items.reduce((sum, item) => sum + ((item.unit_price ?? 0) * (item.quantity || 0)), 0)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Registry-S'
  workbook.lastModifiedBy = 'Registry-S'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet('รายงานครุภัณฑ์และวัสดุ', {
    views: [{ showGridLines: true }],
  })

  // Title Row (Row 1)
  const titleRow = worksheet.addRow(['รายงานทะเบียนครุภัณฑ์และวัสดุสำนักงาน (CAMMS)'])
  titleRow.font = { name: 'Sarabun', bold: true, size: 16, color: { argb: 'FF0F172A' } }
  worksheet.addRow([]) // Row 2 (Blank spacer)

  // Subtitle / Filter Row (Row 3)
  const filterRow = worksheet.addRow([
    `ตัวกรอง: ${filterSummary}`,
    '',
    '',
    '',
    '',
    '',
    '',
    `วันที่พิมพ์: ${formatDate()}`,
  ])
  filterRow.font = { name: 'Sarabun', italic: true, size: 10, color: { argb: 'FF475569' } }
  worksheet.addRow([]) // Row 4 (Blank spacer)

  // Table Header (Row 5)
  const headerRow = worksheet.addRow([...REPORT_EXCEL_HEADERS])
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Sarabun',
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark navy #1E293B
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    }
  })

  // Data Rows
  items.forEach((item, index) => {
    const unitPrice = item.unit_price ?? 0
    const totalRowVal = unitPrice * item.quantity
    const typeLabel =
      ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type
    const statusLabel =
      ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS] || item.status

    const row = worksheet.addRow([
      index + 1,
      item.item_name,
      typeLabel,
      item.category?.name || '-',
      item.location?.name || '-',
      item.quantity,
      item.unit?.name || '-',
      unitPrice,
      totalRowVal,
      item.asset_no || '-',
      item.serial_no || '-',
      item.brand || '-',
      item.model || '-',
      item.responsible_person || '-',
      statusLabel,
    ])

    row.height = 22

    // Quantity format (#,##0)
    const qtyCell = row.getCell(6)
    qtyCell.numFmt = '#,##0'
    qtyCell.alignment = { vertical: 'middle', horizontal: 'right' }

    // Unit price format (#,##0.00)
    const unitPriceCell = row.getCell(8)
    unitPriceCell.numFmt = '#,##0.00'
    unitPriceCell.alignment = { vertical: 'middle', horizontal: 'right' }

    // Total value format (#,##0.00)
    const totalValCell = row.getCell(9)
    totalValCell.numFmt = '#,##0.00'
    totalValCell.alignment = { vertical: 'middle', horizontal: 'right' }

    // General cell styles and borders
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 10, color: { argb: 'FF0F172A' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      if (colNumber === 1 || colNumber === 3 || colNumber === 7 || colNumber === 10 || colNumber === 11 || colNumber === 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colNumber !== 6 && colNumber !== 8 && colNumber !== 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })
  })

  // Summary Row
  const summaryRow = worksheet.addRow([
    'รวมทั้งสิ้น',
    '',
    '',
    '',
    '',
    computedTotalQty,
    '',
    '',
    computedTotalVal,
    '',
    '',
    '',
    '',
    '',
    '',
  ])

  summaryRow.height = 24
  summaryRow.font = { name: 'Sarabun', bold: true, size: 11, color: { argb: 'FF0F172A' } }

  const summaryQtyCell = summaryRow.getCell(6)
  summaryQtyCell.numFmt = '#,##0'
  summaryQtyCell.alignment = { vertical: 'middle', horizontal: 'right' }

  const summaryValCell = summaryRow.getCell(9)
  summaryValCell.numFmt = '#,##0.00'
  summaryValCell.alignment = { vertical: 'middle', horizontal: 'right' }

  summaryRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }

    if (colNumber === 1) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  })

  // Auto-fit Column Widths: Math.max(colHeader.length, maxDataLength) + 4
  worksheet.columns.forEach((column, colIdx) => {
    const colHeader = REPORT_EXCEL_HEADERS[colIdx] || ''
    let maxDataLength = colHeader.length

    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber >= 5 && cell.value !== null && cell.value !== undefined) {
        let cellText = ''
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          cellText = String(cell.value.text)
        } else {
          cellText = String(cell.value)
        }
        if (cellText.length > maxDataLength) {
          maxDataLength = cellText.length
        }
      }
    })

    const calculatedWidth = Math.max(colHeader.length, maxDataLength) + 4
    column.width = Math.max(calculatedWidth, 8)
  })

  return workbook
}

export async function generateReportExcel(
  items: ReportItemRow[],
  options?: ReportExcelOptions | string,
  legacyTotalQty?: number,
  legacyTotalVal?: number
): Promise<ExcelJS.Buffer> {
  const workbook = await buildReportExcelWorkbook(
    items,
    options,
    legacyTotalQty,
    legacyTotalVal
  )
  return workbook.xlsx.writeBuffer()
}
