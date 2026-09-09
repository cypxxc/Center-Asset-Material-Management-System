import assert from 'node:assert/strict'
import { test } from 'node:test'
import { downloadReportExcel } from '../../lib/download-report-excel'

test('downloads compressed response using current filters and releases the object URL', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let clicked = 0
  let removed = 0
  const link = { href: '', download: '', click() { clicked++ }, remove() { removed++ } }
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => link, body: { appendChild() {} },
  } })
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('compressed workbook'))
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:export')
  const revokeUrl = t.mock.method(URL, 'revokeObjectURL', () => {})
  await downloadReportExcel({ q: 'โต๊ะ', sort_by: 'item_name', sort_dir: 'asc', page: '3' }, {
    filename: 'inventory.xlsx', inventory: true, filterSummary: 'ก'.repeat(2100),
  })
  const [request, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit]
  const url = new URL(request, 'https://example.test')
  assert.equal(url.pathname, '/api/reports/export')
  assert.equal(url.searchParams.get('q'), 'โต๊ะ')
  assert.equal(url.searchParams.get('sort_by'), 'item_name')
  assert.equal(url.searchParams.get('inventory'), '1')
  assert.equal(url.searchParams.get('filter_summary')?.length, 2000)
  assert.equal(url.searchParams.has('page'), false)
  assert.equal(options.credentials, 'same-origin')
  assert.equal(createUrl.mock.callCount(), 1)
  assert.equal(link.download, 'inventory.xlsx')
  assert.equal(clicked, 1)
  assert.equal(removed, 1)
  assert.equal(revokeUrl.mock.callCount(), 0)
  t.mock.timers.tick(60_000)
  assert.equal(revokeUrl.mock.callCount(), 1)
})

test('server errors are visible and do not download an error response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'กรุณารอสักครู่' }, { status: 429 }))
  await assert.rejects(downloadReportExcel({}, { filename: 'report.xlsx' }), /กรุณารอสักครู่/)
})

test('interrupted streams fail before creating a downloadable file', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial'))
      controller.error(new Error('stream interrupted'))
    },
  })))
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:partial')
  await assert.rejects(downloadReportExcel({}, { filename: 'report.xlsx' }), /ดาวน์โหลด.*Excel/)
  assert.equal(createUrl.mock.callCount(), 0)
})

test('non-JSON HTTP errors receive a Thai error message', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('proxy unavailable', { status: 502 }))
  await assert.rejects(downloadReportExcel({}, { filename: 'report.xlsx' }), /ดาวน์โหลด.*Excel/)
})

test('inventory defaults match Items sorting and preserve explicit directions', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  for (const [sortBy, direction, expected] of [
    ['item_name', undefined, 'asc'], ['item_type', undefined, 'asc'],
    ['quantity', undefined, 'desc'], [undefined, undefined, 'desc'],
    ['item_name', 'desc', 'desc'], ['quantity', 'asc', 'asc'],
  ]) {
    await assert.rejects(downloadReportExcel({ sort_by: sortBy, sort_dir: direction }, {
      inventory: true, filename: 'inventory.xlsx',
    }))
    const request = fetchMock.mock.calls.at(-1)!.arguments[0] as unknown as string
    assert.equal(new URL(request, 'https://example.test').searchParams.get('sort_dir'), expected)
  }
})
