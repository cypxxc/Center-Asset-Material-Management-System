import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { populateImportTemplate, readTemplateCSV, templateWorkbookCSV, mergeImportCSVs, normalizeImportCSV } from './import-template'
import { parseImportCSV, encodeImportCSV } from '@/lib/import-csv'
test('material template has ledger columns without asset identifiers and preserves zero stock', () => {
  const asset = new ExcelJS.Workbook(), material = new ExcelJS.Workbook()
  populateImportTemplate(asset, 'asset'); populateImportTemplate(material, 'material')
  const headers = Array.from(material.worksheets[0].getRow(1).values as unknown[])
  for (const key of ['specification', 'commodity_code', 'opening_quantity', 'received_quantity', 'issued_quantity', 'balance_amount']) assert.ok(headers.includes(key))
  for (const key of ['asset_no', 'serial_no', 'brand', 'model', 'qualification_status']) assert.ok(!headers.includes(key), key)
  assert.ok(Array.from(asset.worksheets[0].getRow(1).values as unknown[]).includes('asset_no'))
  const result = readTemplateCSV(templateWorkbookCSV(material), 'material')
  assert.equal(result.records[0].quantity, 0)
  assert.equal(result.records[0].item_type, 'material')
  assert.throws(() => readTemplateCSV(templateWorkbookCSV(asset), 'material'), /ประเภท/)
})
test('shared CSV handling preserves commas, quotes and multiline notes', () => {
  const rows = [['item_name', 'note'], ['Paper, A4', 'line 1\nline "2"']]
  assert.deepEqual(parseImportCSV(encodeImportCSV(rows)), rows)
  assert.throws(() => parseImportCSV('name,note\nPaper,"unclosed'))
  assert.throws(() => parseImportCSV('item_name,item_type,quantity\nPaper 12" x 8",material,0'))
})
test('explicit material stock cannot be defaulted from placeholders or blanks', () => {
  for (const quantity of ['-', 'ไม่มี', '']) assert.throws(() => readTemplateCSV(`item_name,item_type,quantity\nPaper,material,${quantity}`, 'material'))
})
test('missing price does not become a zero valuation for positive stock', () => {
  assert.equal(readTemplateCSV('item_name,item_type,quantity,unit_price\nPaper,material,3,', 'material').value, null)
})
test('unexpected columns are rejected instead of discarded when merging templates', () => {
  assert.throws(() => readTemplateCSV('item_name,item_type,quantity,custom_field\nPaper,material,0,important', 'material'))
})

test('future additions accept new names, categories and stock without relying on the original workbook', () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('รายการใหม่ปี 2575')
  sheet.addRow(['quantity', 'category_name', 'item_name', 'item_type', 'unit_name', 'unit_price'])
  sheet.addRow([12, 'วัสดุการเกษตร', 'เมล็ดพันธุ์รายการใหม่', 'material', 'ถุง', 25])
  const csv = templateWorkbookCSV(workbook)
  const result = readTemplateCSV(mergeImportCSVs([csv]), 'material')
  assert.equal(result.count, 1)
  assert.equal(result.records[0].item_name, 'เมล็ดพันธุ์รายการใหม่')
  assert.equal(result.records[0].category_name, 'วัสดุการเกษตร')
  assert.equal(result.records[0].quantity, 12)
  assert.equal(result.value, 300)
})

test('Thai file headings are mapped regardless of order and material type comes from the selected form', () => {
  const csv = 'ราคาต่อหน่วย,หน่วยนับ,ชื่อวัสดุ,จำนวนคงเหลือ,หมวดหมู่\n25,ถุง,เมล็ดพันธุ์,12,วัสดุการเกษตร'
  const result = readTemplateCSV(csv, 'material')
  assert.equal(result.records[0].quantity, 12)
  assert.equal(result.records[0].item_name, 'เมล็ดพันธุ์')
  assert.equal(result.value, 300)
  const [headers, row] = parseImportCSV(normalizeImportCSV(csv, 'material'))
  assert.equal(row[headers.indexOf('item_type')], 'material')
})

test('Excel headings may follow a title and occur in multiple arbitrarily named sheets', () => {
  const workbook = new ExcelJS.Workbook()
  for (const name of ['รายการใหม่', 'รายการเพิ่มเติม']) {
    const sheet = workbook.addWorksheet(name)
    sheet.addRow(['บัญชีวัสดุประจำปี 2575'])
    sheet.addRow([' จำนวน ', 'ชื่อวัสดุ', 'ราคาต่อหน่วย'])
    sheet.addRow([3, name, 10])
  }
  const result = readTemplateCSV(templateWorkbookCSV(workbook, 'material'), 'material')
  assert.equal(result.count, 2)
  assert.equal(result.value, 60)
})

test('duplicate aliases and unknown headings are reported rather than guessed or lost', () => {
  assert.throws(() => readTemplateCSV('ชื่อวัสดุ,จำนวน,quantity\nPaper,1,2', 'material'), /ซ้ำ/)
  assert.throws(() => readTemplateCSV('ชื่อวัสดุ,จำนวน,ข้อมูลพิเศษ\nPaper,1,keep', 'material'), /ข้อมูลพิเศษ/)
  assert.throws(() => readTemplateCSV('ชื่อวัสดุ,จำนวนเงิน\nPaper,300', 'material'), /จำนวน/)
})

test('workbook material headings preserve specification, code, min/max and dated balances', () => {
  const csv = 'ชื่อหรือชนิดวัสดุ,ขนาดหรือลักษณะ,ประเภท,รหัส,หน่วยนับ,จำนวนอย่างสูง,จำนวนอย่างต่ำ,จำนวนคงเหลือ,ราคา/หน่วย,ยอดยกมา (จำนวน),ยอดยกมา (จำนวนเงิน),ปีงบประมาณ,วันที่ยอดคงเหลือ\nกระดาษ A4,80 แกรม,วัสดุสำนักงาน,0014111500,รีม,6,1,160,122,160,19520,2571,2027-10-31'
  const normalized = normalizeImportCSV(csv, 'material')
  const [headers,row] = parseImportCSV(normalized)
  assert.equal(row[headers.indexOf('commodity_code')], '0014111500')
  assert.equal(row[headers.indexOf('specification')], '80 แกรม')
  assert.equal(row[headers.indexOf('opening_amount')], '19520')
  assert.equal(readTemplateCSV(normalized,'material').records[0].category_name,'วัสดุสำนักงาน')
})
