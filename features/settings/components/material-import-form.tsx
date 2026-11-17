'use client'

import { useEffect, useRef, useState } from 'react'
import { ImportUploadPanel, ImportFormatGuide, ImportResult } from './import-form-ui'
import { importItemsBulk } from '@/features/items/actions'
import { assertNoDuplicateMaterials } from '@/features/items/import-validation'
import { type readMaterialLedger } from '@/features/items/material-ledger-importer'
import type { ImportPreviewRecord } from '@/features/items/import-template'
import { formatDate } from '@/lib/date'

type Ledger = ReturnType<typeof readMaterialLedger>
type Prepared = { csv: string; files: Array<{ name: string; count: number; value: number | null; asOf: string | null }>; records: ImportPreviewRecord[]; issues: Ledger['issues'] }

export function MaterialImportForm({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [phase, setPhase] = useState<'reading' | 'saving' | null>(null)
  const busy = phase !== null
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const inFlight = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])

  async function readFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (!files.length || inFlight.current) return
    setPrepared(null)
    setResult(null)
    inFlight.current = true
    setPhase('reading')
    try {
      if (files.length > 4) throw new Error('เลือกได้สูงสุด 4 ไฟล์ต่อครั้ง')
      if (files.some(file => !/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024)) {
        throw new Error('กรุณาเลือกไฟล์ Excel .xlsx ขนาดไม่เกิน 10MB ต่อไฟล์')
      }
      const ExcelJS = (await import('exceljs')).default
      const { prepareMaterialWorkbook } = await import('@/features/items/material-ledger-importer')
      const { readTemplateCSV, mergeImportCSVs } = await import('@/features/items/import-template')
      const records: ImportPreviewRecord[] = [], issues: Ledger['issues'] = []
      const csvFiles: string[] = []
      const summaries: Prepared['files'] = []
      for (const file of files) {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const preparedFile = prepareMaterialWorkbook(workbook, file.name)
        const { csv, asOf } = preparedFile
        issues.push(...preparedFile.issues)
        const preview = readTemplateCSV(csv, 'material')
        records.push(...preview.records)
        csvFiles.push(csv)
        summaries.push({ name: file.name, count: preview.count, value: preview.value, asOf })
      }
      assertNoDuplicateMaterials(records, [])
      const csv = mergeImportCSVs(csvFiles)
      setPrepared({ csv, files: summaries, records, issues })
      setPhase('saving')
      const response = await importItemsBulk(csv, 'material')
      setResult({ success: response.success === true, message: response.message ?? (response.success ? 'นำเข้าวัสดุสำเร็จ' : 'นำเข้าวัสดุไม่สำเร็จ') })
      if (response.success) setPrepared(null)
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : 'ไม่สามารถนำเข้าวัสดุได้ กรุณาลองใหม่' })
    } finally {
      inFlight.current = false
      setPhase(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <form aria-label="นำเข้าวัสดุ" onSubmit={event => event.preventDefault()} className="space-y-6">
      <h2 className="text-base font-semibold">นำเข้าวัสดุ</h2>
      <p className="text-sm text-muted-foreground">เลือกไฟล์แล้วระบบจะตรวจสอบและนำเข้าทันทีเมื่อข้อมูลผ่าน</p>
      <ImportUploadPanel type="material" busy={busy}
        busyLabel={phase === 'saving' ? 'กำลังนำเข้าวัสดุ…' : 'กำลังอ่านและตรวจสอบไฟล์…'}
        busyDescription={phase === 'saving'
          ? `กำลังบันทึกวัสดุ ${prepared?.records.length.toLocaleString('th-TH') ?? ''} รายการ กรุณารอจนกว่าระบบจะแจ้งผล`
          : 'กำลังจัดเตรียมรายการและตรวจสอบข้อมูลก่อนนำเข้า กรุณารอสักครู่'}
        inputRef={inputRef} onChange={readFiles} onDownload={async () => {
        try { const { downloadImportTemplate } = await import('@/features/items/import-template'); await downloadImportTemplate('material') }
        catch { setResult({ success: false, message: 'ดาวน์โหลดเทมเพลตไม่สำเร็จ' }) }
      }} />

      {prepared && (
        <section aria-label="สรุปไฟล์วัสดุ" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold">สรุปไฟล์ที่ตรวจสอบแล้ว</h3>
          <ul className="divide-y divide-border">
            {prepared.files.map((file, index) => <li key={`${file.name}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0 break-words">{file.name}</span><span>{file.count} รายการ · {file.value === null ? 'มูลค่าไม่ครบ (มีรายการไม่ระบุราคา)' : `${file.value.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}{file.asOf ? ` · ยอด ณ ${formatDate(file.asOf)}` : ''}</span></li>)}
          </ul>
          <p className="text-sm font-medium">รวม {prepared.records.length} รายการ · ยอดศูนย์ {prepared.records.filter(row => row.quantity === 0).length} รายการ</p>
          <p className="text-sm">{prepared.files.some(file => file.value === null) ? 'มูลค่ารวมไม่ครบ เนื่องจากมีรายการไม่ระบุราคา' : `มูลค่าตามไฟล์ ${prepared.files.reduce((sum, file) => sum + (file.value ?? 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`} · ยอดตามไฟล์ที่เลือก</p>
          {prepared.issues.length > 0 && <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">ข้อสังเกตจากต้นฉบับ {prepared.issues.length} จุด (คงข้อมูลเดิม)</summary><ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs text-muted-foreground">{prepared.issues.map((issue, index) => <li key={index}>{issue.item_name}: {issue.issue}</li>)}</ul></details>}
        </section>
      )}
      {result && <ImportResult success={result.success} message={result.message} />}
      <ImportFormatGuide type="material" />
    </form>
  )
}
