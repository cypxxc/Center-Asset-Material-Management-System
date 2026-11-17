import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { readMaterialLedger, materialLedgerCSV, prepareMaterialWorkbook } from './material-ledger-importer'
import { readTemplateCSV } from './import-template'

function ledger() {
  const w = new ExcelJS.Workbook()
  const s = w.addWorksheet('รายการวัสดุ')
  s.getCell('A2').value = 'ปีงบประมาณ พ.ศ. 2570'
  s.mergeCells('I5:J5'); s.getCell('I5').value = 'ยอดคงเหลือยกมา'
  s.mergeCells('O5:Q5'); s.getCell('O5').value = 'คงเหลือ'
  s.getCell('O6').value = '(ณ 31 ต.ค. 69)'
  s.getRow(9).values = [1, 'ฟองน้ำ ', 'ขนาดเดิม', 'วัสดุสำนักงาน', 1234, 'อัน/โหล', 6, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  s.getCell('O9').value = { formula: '0', result: 0 }
  const d = w.addWorksheet('1'); d.getCell('E4').value = 'ฟองน้ำ '; d.getCell('F9').value = 0
  return w
}
test('material ledger reader preserves original name/unit/zero and source cells', () => {
  const result = readMaterialLedger(ledger(), 'renamed.xlsx')
  assert.equal(result.count, 1)
  assert.equal(result.records[0].item_name, 'ฟองน้ำ ')
  assert.equal(result.records[0].unit_name, 'อัน/โหล')
  assert.equal(result.records[0].quantity, 0)
  assert.equal(result.records[0].source_key, '[CAMMS-MATERIAL-2570:1:1]')
  assert.equal(JSON.parse(result.records[0].note).source_fields.specification, 'ขนาดเดิม')
  assert.match(materialLedgerCSV(result.records), /"material"/)
})
test('wrong format and empty ledgers fail before any import', () => {
  assert.throws(() => readMaterialLedger(ledger(), 'wrong.xlsx', 'วัสดุคอมพิวเตอร์'))
  const w = ledger(); w.worksheets[0].spliceRows(9, 1)
  assert.throws(() => readMaterialLedger(w, 'empty.xlsx'), /ไม่พบรายการ/)
})
test('future ledgers use their own fiscal year, balance date and new category', () => {
  const w = ledger()
  w.worksheets[0].getCell('A2').value = 'ปีงบประมาณ พ.ศ. 2571'
  w.worksheets[0].getCell('O6').value = 'ณ 31 ต.ค. 70'
  w.worksheets[0].getCell('D9').value = 'วัสดุการเกษตร'
  const result = readMaterialLedger(w, 'new-stock.xlsx')
  assert.equal(result.asOf, '2027-10-31')
  assert.equal(result.records[0].category_name, 'วัสดุการเกษตร')
  assert.equal(JSON.parse(result.records[0].note).as_of, '2027-10-31')
  assert.match(result.records[0].source_key, /^\[CAMMS-MATERIAL-2571:/)
})

test('balance dates must be valid and never fall back to the original test date', () => {
  for (const date of ['', 'ณ 31 ก.พ. 70', 'unknown date']) {
    const w = ledger()
    w.worksheets[0].getCell('O6').value = date
    assert.throws(() => readMaterialLedger(w, 'invalid-date.xlsx'), /วันที่/)
  }
})

test('legacy ledger dates accept full Buddhist years with or without a space after the month', () => {
  for (const date of ['(ณ 31 ต.ค.2569)', '(ณ 31 ต.ค. 2569)']) {
    const w = ledger()
    w.worksheets[0].getCell('O6').value = date
    assert.equal(readMaterialLedger(w, 'source.xlsx').asOf, '2026-10-31')
  }
})

test('future files with the same ordinal in different new categories have distinct source keys', () => {
  const first = ledger(), second = ledger()
  first.worksheets[0].getCell('D9').value = 'วัสดุการเกษตร'
  second.worksheets[0].getCell('D9').value = 'วัสดุก่อสร้าง'
  assert.notEqual(readMaterialLedger(first, 'one.xlsx').records[0].source_key,
    readMaterialLedger(second, 'two.xlsx').records[0].source_key)
})

test('a flat table named รายการวัสดุ is read by its headings rather than forced into the legacy layout', () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('รายการวัสดุ')
  sheet.addRow(['ชื่อวัสดุ', 'จำนวน', 'หน่วยนับ'])
  sheet.addRow(['รายการใหม่', 5, 'กล่อง'])
  const prepared = prepareMaterialWorkbook(workbook, 'new.xlsx')
  const result = readTemplateCSV(prepared.csv, 'material')
  assert.equal(result.records[0].quantity, 5)
  assert.equal(prepared.asOf, null)
})
