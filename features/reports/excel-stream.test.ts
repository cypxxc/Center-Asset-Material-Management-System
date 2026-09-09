import '../../tests/setup/server-only'
import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { createReportExcelStream } from './excel-stream'
import type { ReportItemRow } from './queries'

const item = (id: number) => ({ id: String(id), item_name: `โต๊ะ ${id}`, item_type: 'asset', quantity: 2, unit_price: 10, status: 'active', category: null, unit: null, location: null } as ReportItemRow)
test('streaming workbook contains all 5501 rows and correct totals', async () => {
  async function* batches() {
    for (let start = 0; start < 5501; start += 500) yield Array.from({ length: Math.min(500, 5501 - start) }, (_, i) => item(start + i))
  }
  const { stream, done } = createReportExcelStream(batches(), { filterSummary: 'ทั้งหมด' })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.read(stream)
  await done
  const sheet = workbook.worksheets[0]
  assert.equal(sheet.rowCount, 5507)
  assert.equal(sheet.getRow(5506).getCell(2).value, 'โต๊ะ 5500')
  assert.equal(sheet.getRow(5507).getCell(6).value, 11002)
  assert.equal(sheet.getRow(5507).getCell(9).value, 110020)
})
test('batch failure aborts stream instead of completing a partial workbook', async () => {
  async function* batches() { yield [item(1)]; throw new Error('batch offline') }
  const { stream, done } = createReportExcelStream(batches())
  const consume = async () => { for await (const chunk of stream) void chunk }
  await assert.rejects(consume(), /batch offline/)
  await assert.rejects(done, /batch offline/)
})

test('an already cancelled request destroys the response without fetching rows', async () => {
  let fetched = false
  async function* batches() { fetched = true; yield [item(1)] }
  const controller = new AbortController()
  controller.abort(new Error('request already cancelled'))
  const { stream, done } = createReportExcelStream(batches(), { signal: controller.signal })
  await assert.rejects(done, /request already cancelled/)
  assert.equal(stream.destroyed, true)
  assert.equal(fetched, false)
})
test('slow or absent reader bounds production and cancellation stops fetching', async () => {
  let fetched = 0
  async function* batches() {
    for (let page = 0; page < 1000; page++) {
      fetched++
      yield Array.from({ length: 500 }, (_, i) => ({ ...item(i), item_name: Array.from({ length: 20 }, () => Math.random().toString(36)).join('') }))
    }
  }
  const { stream, done } = createReportExcelStream(batches())
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.ok(fetched > 0, 'Producer must have started successfully')
  assert.ok(fetched < 10, `Producer ran ahead by ${fetched} batches`)
  stream.destroy(new Error('cancel download'))
  await assert.rejects(done)
  const stopped = fetched
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(fetched, stopped)
})
