'use client'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/date'
import { inspectPoolHistory } from '../actions'

export function PoolHistoryAudit() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<NonNullable<Awaited<ReturnType<typeof inspectPoolHistory>>['data']> | null>(null)

  async function inspect() {
    setLoading(true); setError('')
    try {
      const result = await inspectPoolHistory()
      if (result.ok && result.data) setReport(result.data)
      else setError(result.error || 'ตรวจสอบไม่สำเร็จ')
    } catch { setError('ตรวจสอบไม่สำเร็จ กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (value) void inspect() }}>
      <Dialog.Trigger asChild><Button variant="outline" size="sm" className="font-normal">ตรวจสอบย้อนหลัง</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content aria-describedby="pool-audit-scope" className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
            <Dialog.Title className="text-sm font-semibold">ตรวจสอบสถานะส่วนกลางย้อนหลัง</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label="ปิดผลตรวจสอบ"><X className="size-4" /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 space-y-4 overflow-auto p-4 sm:p-6">
            <Dialog.Description id="pool-audit-scope" className="text-xs leading-relaxed text-muted-foreground">เทียบติ๊กส่วนกลางและหมายเหตุกับประวัติจ่าย ยืม รับคืน และมอบหมายล่าสุดของครุภัณฑ์ที่มีประวัติในระบบ ผลตรวจนี้ยังไม่เปลี่ยนข้อมูลเดิม</Dialog.Description>
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />กำลังตรวจสอบประวัติ...</div>
              : error ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={inspect}>ลองใหม่</Button></div>
                : report && <>
                  <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs">
                    <span>ตรวจสอบ {report.checked.toLocaleString()} รายการ</span>
                    <span className="font-medium">ควรตรวจทาน {report.findings.length.toLocaleString()} รายการ</span>
                    <span className="text-muted-foreground">{formatDateTime(report.checked_at)}</span>
                  </div>
                  {report.findings.length ? <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="table-data-uniform w-full text-left text-xs">
                      <thead className="bg-muted/40 text-muted-foreground"><tr>{['สิ่งของ', 'ส่วนกลางปัจจุบัน', 'ตามประวัติ', 'เหตุผล / หลักฐาน'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">{report.findings.map((row) => <tr key={row.id}>
                        <td className="px-4 py-3"><Link href={`/items/${row.id}`} className="font-medium hover:text-primary hover:underline">{row.item_name}</Link><p className="mt-1 break-words text-muted-foreground">{row.asset_no || '-'}</p></td>
                        <td className="px-4 py-3">{row.is_central ? 'ติ๊กอยู่' : 'ไม่ติ๊ก'}{row.note_mismatch && <p className="mt-1 text-muted-foreground">หมายเหตุไม่ตรงตามประวัติ</p>}</td>
                        <td className="px-4 py-3 font-medium">{row.expected_central ? 'ควรเป็นส่วนกลาง' : 'ควรนำออกจากส่วนกลาง'}</td>
                        <td className="space-y-1 px-4 py-3"><p>{row.reason}</p><p className="text-muted-foreground">{formatDateTime(row.event_at)}</p>{row.document_id ? <Link href={`/disbursements/${row.document_id}`} className="text-primary hover:underline">{row.document_no || 'ดูรายการอ้างอิง'}</Link> : <p className="text-muted-foreground">ประวัติมอบหมายผู้ถือครอง</p>}</td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบสถานะที่ขัดกับประวัติในรายการที่ตรวจสอบ</p>}
                </>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
