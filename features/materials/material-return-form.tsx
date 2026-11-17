'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptMaterialReturn } from './stock-actions'

const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring'
export function MaterialReturnForm({ lineId, remaining, unit, onSuccess }: { lineId: string; remaining: number; unit?: string | null; onSuccess?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [uncertain, setUncertain] = useState(false)
  const pendingCommand = useRef<Record<string, unknown> | null>(null)
  if (remaining < 1) return null
  function submit(form: FormData) {
    pendingCommand.current ??= { line_id: lineId, request_key: crypto.randomUUID(), quantity: form.get('quantity'), accepted_quantity: form.get('accepted_quantity'), reason: form.get('reason'), reference: form.get('reference') }
    setError('')
    startTransition(async () => {
      try {
        const result = await acceptMaterialReturn(pendingCommand.current)
        setUncertain(false)
        if (!result.success) { setError(result.error); return }
        pendingCommand.current = null; setOpen(false); setQuantity(1); router.refresh(); onSuccess?.()
      } catch {
        setUncertain(true)
        setError('ยังไม่ได้รับผลยืนยัน กรุณาลองยืนยันรายการเดิมอีกครั้งก่อนเปลี่ยนข้อมูล')
      }
    })
  }
  return <div className="space-y-3"><button type="button" onClick={() => setOpen(value => !value)} disabled={busy || uncertain} aria-expanded={open} className="rounded-md border border-border px-3 py-2 text-xs font-medium">{open ? 'ปิดแบบฟอร์มรับคืน' : 'รับคืนวัสดุใช้ไม่หมด'}</button>
    {open && <form onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} onChange={() => { if (!uncertain) pendingCommand.current = null }} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">รับคืนได้อีก {remaining} {unit || 'หน่วย'} เพิ่มยอดพร้อมเบิกเฉพาะจำนวนที่ตรวจรับพร้อมใช้งาน จำนวนที่ไม่ผ่านตรวจยังคงมีหลักฐานรับคืน</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <fieldset disabled={busy || uncertain} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">จำนวนส่งคืน<input className={field} name="quantity" type="number" min={1} max={remaining} step={1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} required /></label>
        <label className="text-sm">จำนวนตรวจรับพร้อมใช้<input className={field} name="accepted_quantity" type="number" min={0} max={Math.min(quantity, remaining)} step={1} defaultValue={0} required /></label>
        <label className="text-sm">เหตุผล / ผลการตรวจ<input className={field} name="reason" required maxLength={500} /></label>
        <label className="text-sm">เอกสารรับคืนอ้างอิง<input className={field} name="reference" required maxLength={500} /></label>
      </fieldset>
      <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'กำลังบันทึก…' : uncertain ? 'ลองยืนยันรายการเดิมอีกครั้ง' : 'ยืนยันตรวจรับคืน'}</button>
    </form>}
  </div>
}
