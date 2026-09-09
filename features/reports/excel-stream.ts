import 'server-only'
import ExcelJS from 'exceljs'
import { PassThrough } from 'node:stream'
import { once } from 'node:events'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { REPORT_EXCEL_HEADERS } from '@/lib/reports-excel-generator'
import type { ReportItemRow } from './queries'

type StreamOptions = { filterSummary?: string; signal?: AbortSignal; onCancel?: () => void; inventory?: boolean }
type StreamingInternals = {
  _openStream(path: string): PassThrough
  zip: { append(stream: PassThrough, options: { name: string }): void; abort(): void }
}

export function createReportExcelStream(batches: AsyncIterable<ReportItemRow[]>, options: StreamOptions = {}) {
  const output = new PassThrough({ highWaterMark: 64 * 1024 })
  output.on('error', () => {}) // Consumers still receive rejection; avoid an unhandled event before attaching them.
  const cancelled = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, cancelled.signal]) : cancelled.signal
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false })
  const internal = workbook as unknown as StreamingInternals
  const parts = new Set<PassThrough>()
  // ExcelJS 4.x's internal StreamBuf ignores backpressure. Standard bounded
  // streams let committed rows wait for ZIP/download capacity. Covered by the
  // slow-reader test; recheck this small adapter when upgrading ExcelJS.
  internal._openStream = path => {
    const part = new PassThrough({ highWaterMark: 64 * 1024 })
    const write = part.write.bind(part)
    part.write = (chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
      // ExcelJS reuses a mutable StringBuf; copy before queuing the bytes.
      const value = chunk && typeof chunk === 'object' && 'toBuffer' in chunk
        ? Buffer.from((chunk as { toBuffer(): Buffer }).toBuffer()) : chunk
      return typeof encoding === 'function' ? write(value, encoding) : write(value, encoding ?? 'utf8', callback)
    }
    part.on('error', () => {})
    parts.add(part)
    internal.zip.append(part, { name: path })
    part.on('finish', () => part.emit('zipped'))
    return part
  }
  const stop = () => {
    const error = signal.reason instanceof Error ? signal.reason : new Error('Export cancelled')
    internal.zip.abort()
    for (const part of parts) part.destroy(error)
    output.destroy(error)
    options.onCancel?.()
  }
  signal.addEventListener('abort', stop, { once: true })
  output.on('close', () => { if (!output.readableEnded) cancelled.abort(new Error('Export download closed')) })
  // Abort events are not replayed when the request ended before setup.
  if (signal.aborted) stop()

  const done = (async () => {
    signal.throwIfAborted()
    workbook.creator = 'CAMMS'
    const sheet = workbook.addWorksheet('รายงานครุภัณฑ์และวัสดุ', { views: [{ state: 'frozen', ySplit: 5 }] })
    const widths = [10, 36, 18, 24, 24, 14, 14, 22, 22, 24, 24, 20, 20, 26, 18]
    if (options.inventory) widths.push(36)
    sheet.columns = widths.map(width => ({ width }))
    const title = sheet.addRow(['รายงานทะเบียนครุภัณฑ์และวัสดุสำนักงาน (CAMMS)'])
    title.font = { name: 'Sarabun', bold: true, size: 16 }
    title.commit()
    sheet.addRow([]).commit()
    sheet.addRow([`ตัวกรอง: ${options.filterSummary ?? 'ทั้งหมด'}`]).commit()
    sheet.addRow([]).commit()
    const header = sheet.addRow(options.inventory ? [...REPORT_EXCEL_HEADERS, 'หมายเหตุ'] : [...REPORT_EXCEL_HEADERS])
    header.font = { name: 'Sarabun', bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    header.height = 28
    header.commit()
    let count = 0
    let quantity = 0
    let value = 0
    const worksheetStream = (sheet as unknown as { stream: PassThrough }).stream
    for await (const batch of batches) {
      signal.throwIfAborted()
      for (const item of batch) {
        if (++count > 1048570) throw new Error('Excel row limit exceeded')
        quantity += item.quantity
        const price = item.unit_price ?? 0
        value += item.quantity * price
        const values = [count, item.item_name, ITEM_TYPE_LABELS[item.item_type] || item.item_type, item.category?.name || '-', item.location?.name || '-', item.quantity, item.unit?.name || '-', price, item.quantity * price, item.asset_no || '-', item.serial_no || '-', item.brand || '-', item.model || '-', item.responsible_person || '-', ITEM_STATUS_LABELS[item.status] || item.status]
        if (options.inventory) values.push(item.note || '-')
        const row = sheet.addRow(values)
        row.font = { name: 'Sarabun', size: 10 }
        row.getCell(6).numFmt = '#,##0'
        row.getCell(8).numFmt = '#,##0.00'
        row.getCell(9).numFmt = '#,##0.00'
        row.commit()
        if (worksheetStream.writableNeedDrain) await once(worksheetStream, 'drain', { signal })
        signal.throwIfAborted()
      }
    }
    signal.throwIfAborted()
    const totals = sheet.addRow(['รวมทั้งสิ้น', '', '', '', '', quantity, '', '', value])
    totals.font = { name: 'Sarabun', bold: true }
    totals.getCell(6).numFmt = '#,##0'
    totals.getCell(9).numFmt = '#,##0.00'
    totals.commit()
    sheet.commit()
    await workbook.commit()
  })().catch(error => {
    cancelled.abort(error)
    throw error
  }).finally(() => signal.removeEventListener('abort', stop))
  void done.catch(() => {}) // Also expose the promise to route logging/tests.
  return { stream: output, done }
}
