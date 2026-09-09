import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ExcelJS from 'exceljs'
import { ImportSection } from '../../features/settings/components/metadata-sections'

test('downloaded import template is a valid workbook with headers and no inventory rows', async (t) => {
  let download: Blob | undefined
  const descriptors = ['createObjectURL', 'revokeObjectURL'].map(key => [key, Object.getOwnPropertyDescriptor(window.URL, key)] as const)
  Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { download = blob; return 'blob:template' } })
  Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: () => {} })
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(window.URL, key, descriptor)
      else Reflect.deleteProperty(window.URL, key)
    }
  })
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {})
  render(<ImportSection />)
  fireEvent.click(screen.getByText('ดาวน์โหลดเทมเพลต (Excel)'))
  await waitFor(() => assert.ok(download))
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await download!.arrayBuffer())
  const sheet = workbook.worksheets[0]
  assert.equal(sheet.rowCount, 1)
  assert.equal(sheet.columnCount, 13)
  assert.equal(sheet.getCell('A1').value, 'item_name')
  assert.equal(sheet.getCell('B1').value, 'item_type')
  assert.equal(sheet.getCell('M1').value, 'note')
  assert.equal(screen.queryByText('ตัวอย่างข้อมูล'), null)
})
