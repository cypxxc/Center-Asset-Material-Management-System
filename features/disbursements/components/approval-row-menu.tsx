'use client'

import { useId, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Loader2, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rejectDisbursement, cancelDisbursementDraft, reverseDisbursement } from '../actions'
import type { DisbursementRow } from '../types'

export function ApprovalRowMenu({ doc, disabled, onBusyChange, onComplete }: {
  doc: Pick<DisbursementRow, 'id' | 'status' | 'recipient_name' | 'transaction_type' | 'purpose'>
  disabled: boolean
  onBusyChange: (busy: boolean) => void
  onComplete: () => void
}) {

  const [action, setAction] = useState<'cancel' | null>('cancel')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const submitting = useRef(false)
  const [completed, setCompleted] = useState(false)
  const reasonId = useId()
  const approved = doc.status === 'confirmed' || doc.status === 'active_borrow'
  const actionable = doc.status === 'pending_approval' || doc.status === 'draft' || approved

  async function submit() {
    if (!actionable || disabled || submitting.current || completed) return
    if (approved && !reason.trim()) { setError('กรุณาระบุเหตุผลการยกเลิก'); return }
    submitting.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      const result = approved
          ? await reverseDisbursement({ disbursement_id: doc.id, reason: reason.trim() })
          : doc.status === 'pending_approval'
          ? await rejectDisbursement(doc.id, reason.trim() || undefined)
          : await cancelDisbursementDraft({ id: doc.id })
      if (!result.ok) {
        setError(result.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }
      setAction(null)
      setCompleted(true)
      onComplete()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      submitting.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={!actionable || busy || completed || disabled} onClick={() => { setError(''); setReason(''); setAction('cancel') }}>ยกเลิก</Button>
      </div>
      {error && action !== 'cancel' && <p role="alert" className="mt-1 whitespace-normal text-xs text-destructive">{error}</p>}
      <Dialog.Root open={action === 'cancel'} onOpenChange={(open) => { if (!open && !busy) setAction(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card text-left text-card-foreground shadow-xl focus:outline-none">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="ปิดหน้าต่าง"><X className="h-4 w-4" /></Button>
                </Dialog.Close>
              </div>
              <Dialog.Title className="text-lg font-semibold">ยกเลิกคำขอนี้?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {approved ? 'ระบบจะย้อนการจ่าย คืนจำนวนวัสดุหรือผู้ครอบครองเดิม และบันทึกเหตุผลการยกเลิกไว้ในประวัติ' : doc.status === 'pending_approval' ? 'คำขอจะถูกนำออกจากรายการ และจะไม่มีการจ่ายวัสดุ' : 'ร่างนี้จะเปลี่ยนเป็น “ยกเลิกแล้ว” และไม่สามารถแก้ไขต่อได้'}
              </Dialog.Description>
              <dl className="my-5 space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex gap-4"><dt className="w-20 shrink-0 text-muted-foreground">ผู้ขอ</dt><dd className="min-w-0 break-words font-medium">{doc.recipient_name || 'ไม่ระบุชื่อ'}</dd></div>
                <div className="flex gap-4"><dt className="w-20 shrink-0 text-muted-foreground">ประเภท</dt><dd>{doc.transaction_type === 'asset_borrow' ? 'ยืม' : 'เบิก'}</dd></div>
                {doc.purpose && <div className="flex gap-4"><dt className="w-20 shrink-0 text-muted-foreground">วัตถุประสงค์</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{doc.purpose}</dd></div>}
              </dl>
              {(doc.status === 'pending_approval' || approved) && <div>
                <label htmlFor={reasonId} className="mb-2 block text-sm font-medium">เหตุผลการยกเลิก <span className="font-normal text-muted-foreground">{approved ? '(จำเป็น)' : '(ไม่บังคับ)'}</span></label>
                <textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} rows={3} placeholder="ระบุเหตุผลเพื่อบันทึกไว้กับคำขอ" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
              </div>}
              {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
              <Dialog.Close asChild><Button variant="outline" disabled={busy}>กลับ</Button></Dialog.Close>
              <Button variant="destructive" disabled={busy} onClick={() => submit()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {busy ? 'กำลังยกเลิก...' : 'ยกเลิกคำขอ'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
