import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { convertExcelToStandardCSV, STANDARD_CSV_HEADERS } from './excel-importer'
import { parseImportCSV } from '../../lib/import-csv'

test('official asset rows include empty material fields to match the CSV header', () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('สำนักงาน')
  sheet.addRow(['ลำดับ', 'รายการครุภัณฑ์', 'เลขครุภัณฑ์', 'ราคา', 'หมายเหตุ'])
  sheet.addRow([1, 'โต๊ะ', 'TEST-001', 1200, 'ห้องประชุม, ชั้น 2'])
  const [headers, row] = parseImportCSV(convertExcelToStandardCSV(workbook))
  assert.equal(row.length, headers.length)
  assert.equal(row[headers.indexOf('asset_no')], 'TEST-001')
  assert.equal(row[headers.indexOf('note')], 'ห้องประชุม, ชั้น 2')
  assert.ok(row.slice(headers.indexOf('specification'), headers.indexOf('register_sequence')).every(value => value === ''))
})

test('merged condition group is replaced by its usable/damaged/deteriorated subheaders', async () => {
  const source = new ExcelJS.Workbook()
  const sheet = source.addWorksheet('สำนักงาน')
  sheet.addRow(['ลำดับ', 'รายการครุภัณฑ์', 'เลขครุภัณฑ์', 'สภาพพัสดุ'])
  sheet.mergeCells('D1:F1')
  sheet.addRow(['', '', '', 'ใช้งานได้', 'ชำรุด', 'เสื่อมสภาพ'])
  sheet.addRow([1, 'โต๊ะ', 'ASSET-1', '/', '', ''])
  sheet.addRow([2, 'เก้าอี้', 'ASSET-2', '', '/', ''])
  sheet.addRow([3, 'ตู้', 'ASSET-3', '', '', '/'])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await source.xlsx.writeBuffer())
  const rows = convertExcelToStandardCSV(workbook).split('\n').slice(1)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map(row => row.split(',')[STANDARD_CSV_HEADERS.indexOf('status')]), ['"active"', '"damaged"', '"inactive"'])
})

test('Excel import maps legacy conditions to supported values before saving', () => {
  for (const [condition, expected] of [
    ['ใช้งานได้', 'active'], ['สำรอง', 'active'], ['ชำรุด', 'damaged'],
    ['waiting_repair', 'damaged'], ['เสื่อมสภาพ', 'inactive'], ['disposed', 'inactive'],
  ]) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('สำนักงาน')
    sheet.addRow(['item_name', 'status'])
    sheet.addRow(['โต๊ะทดสอบ', condition])
    const row = convertExcelToStandardCSV(workbook).split('\n')[1].split(',')
    assert.equal(row[STANDARD_CSV_HEADERS.indexOf('status')], `"${expected}"`)
  }
})

test('imports a workbook with a merged empty banner above its headers', async () => {
  const source = new ExcelJS.Workbook()
  const sheet = source.addWorksheet('สำนักงาน')
  sheet.mergeCells('A1:D1')
  sheet.addRow(['ลำดับ', 'รายการครุภัณฑ์', 'เลขครุภัณฑ์', 'ราคา'])
  sheet.addRow([1, 'โต๊ะทดสอบ', 'TEST-001', 1200])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await source.xlsx.writeBuffer())
  const csv = convertExcelToStandardCSV(workbook)
  assert.equal(csv.split('\n').length, 2)
  assert.ok(csv.includes('"โต๊ะทดสอบ"'))
  assert.ok(csv.includes('"TEST-001"'))
  assert.ok(csv.includes('"1200"'))
})
