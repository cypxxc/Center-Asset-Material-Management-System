import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCompactDOM, type InteractiveElement } from '../../scripts/ai-uat/dom-extractor'

test('formatCompactDOM serializes interactive elements into readable lines', () => {
  const elements: InteractiveElement[] = [
    { id: 1, tag: 'button', label: 'บันทึกข้อมูล', disabled: false, selector: 'button:has-text("บันทึกข้อมูล")' },
    { id: 2, tag: 'input', label: 'ชื่อพัสดุ', value: '', disabled: false, selector: 'input[name="name"]' },
    { id: 3, tag: 'select', label: 'หมวดหมู่', value: '7110', disabled: false, selector: 'select[name="category_id"]' },
    { id: 4, tag: 'button', label: 'ลบ', disabled: true, selector: 'button:has-text("ลบ")' },
  ]
  const formatted = formatCompactDOM('/items/new', elements)
  assert.match(formatted, /URL: \/items\/new/)
  assert.match(formatted, /\[#1\] button "บันทึกข้อมูล"/)
  assert.match(formatted, /\[#2\] input "ชื่อพัสดุ"/)
  assert.match(formatted, /\[#3\] select "หมวดหมู่" \(ค่า: 7110\)/)
  assert.match(formatted, /\[#4\] button "ลบ" \(ปิดใช้งาน\)/)
})

test('formatCompactDOM handles empty interactive elements gracefully', () => {
  const formatted = formatCompactDOM('/dashboard', [])
  assert.match(formatted, /ไม่มี interactive elements/)
})
