import test from 'node:test'
import assert from 'node:assert/strict'
import { itemFormSchema } from './schema'
import ExcelJS from 'exceljs'
import { convertExcelToStandardCSV } from './excel-importer'
import { parseImportCSV } from '../../lib/import-csv'

const base = { item_name: 'โต๊ะ', item_type: 'asset', quantity: 1, status: 'active' }

test('asset form retains register identity and zero accounting amounts', () => {
  const result = itemFormSchema.parse({ ...base, register_sequence: '001', asset_prefix: 'สขส 7.',
    register_accumulated_depreciation: '1,200.50', register_book_value: '0', register_as_of: '2026-10-31' })
  assert.equal(result.register_sequence, '001')
  assert.equal(result.asset_prefix, 'สขส 7.')
  assert.equal(result.register_accumulated_depreciation, 1200.5)
  assert.equal(result.register_book_value, 0)
  assert.equal(result.register_as_of, '2026-10-31')
  // The supplied register records accumulated depreciation as a negative amount.
  assert.equal(itemFormSchema.parse({ ...base, register_accumulated_depreciation: '-13,999' }).register_accumulated_depreciation, -13999)
})

test('blank register values remain unknown; invalid amounts and dates are rejected', () => {
  const result = itemFormSchema.parse(base)
  assert.equal(result.register_book_value, null)
  assert.equal(result.register_sequence, null)
  for (const register_book_value of ['-1', 'NaN', '1000000000000']) {
    assert.equal(itemFormSchema.safeParse({ ...base, register_book_value }).success, false)
  }
  assert.equal(itemFormSchema.safeParse({ ...base, register_as_of: '2026-02-30' }).success, false)
})

test('official Excel preserves sequence, prefix, and recorded accounting amounts', () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('สำนักงาน')
  sheet.addRow(['ลำดับ', 'รายการครุภัณฑ์', 'เลขครุภัณฑ์', 'เลขครุภัณฑ์', 'ค่าเสื่อมราคาสะสม', 'มูลค่าตามบัญชี'])
  sheet.addRow([1, 'โต๊ะ', 'สขส 7.', '7110-001/58', 1200.5, 0])
  const [headers, row] = parseImportCSV(convertExcelToStandardCSV(workbook))
  const get = (key: string) => row[headers.indexOf(key)]
  assert.equal(get('register_sequence'), '1')
  assert.equal(get('asset_prefix'), 'สขส 7.')
  assert.equal(get('asset_no'), 'สขส 7. 7110-001/58')
  assert.equal(get('register_accumulated_depreciation'), '1200.5')
  assert.equal(get('register_book_value'), '0')
})
