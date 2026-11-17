import test from 'node:test'
import assert from 'node:assert/strict'
import { materialNoteForDisplay } from './material-note'

test('import metadata is displayed with readable Thai labels instead of JSON keys', () => {
  const text = materialNoteForDisplay(JSON.stringify({ source_key: '[CAMMS-MATERIAL-2570:1:1]', source_file: 'วัสดุ.xlsx', source_row: 9, as_of: '2026-10-31', source_fields: { name: 'กระดาษ' } }))
  assert.match(text, /ไฟล์ต้นทาง: วัสดุ.xlsx/)
  assert.match(text, /แถวในไฟล์: 9/)
  assert.match(text, /วันที่ยอดตามบัญชี: 31-ต.ค.-69/)
  assert.doesNotMatch(text, /source_key|source_fields|CAMMS-MATERIAL/)
})

test('ordinary notes and unrelated or malformed JSON remain unchanged', () => {
  for (const note of ['หมายเหตุผู้ใช้\nบรรทัดที่สอง', '{"custom":"value"}', '{broken', 'null', '[1,2]']) {
    assert.equal(materialNoteForDisplay(note), note)
  }
  assert.equal(materialNoteForDisplay(null), '- ไม่มีหมายเหตุ -')
})

test('incomplete import metadata does not display undefined or fail on invalid dates', () => {
  assert.equal(materialNoteForDisplay('{"source_key":"[CAMMS-MATERIAL-2570:1:1]","as_of":"invalid"}'), 'นำเข้าจากบัญชีวัสดุ')
})
