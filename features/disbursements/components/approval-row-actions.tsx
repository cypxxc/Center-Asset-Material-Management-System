'use client'

import { useId, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { confirmDisbursement } from '../actions'
import type { DisbursementRow } from '../types'
import { bangkokCalendarDate, borrowDueDateError } from '../borrow-dates'

const ApprovalRowMenu = dynamic(() => import('./approval-row-menu').then(module => module.ApprovalRowMenu), {
  ssr: false,
  loading: () => <Button variant="outline" size="sm" disabled aria-busy="true">กำลังโหลด...</Button>,
})

export function ApprovalRowActions({ doc, className }: {
  doc: Pick<DisbursementRow, 'id' | 'status' | 'recipient_name' | 'transaction_type' | 'purpose'> & { due_date?: string | null }
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [menuBusy, setMenuBusy] = useState(false)
  const [menuRequested, setMenuRequested] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const [replacementDueDate, setReplacementDueDate] = useState('')
  const dueInputId = useId()
  const submitting = useRef(false)
  const [previousStatus, setPreviousStatus] = useState(doc.status)
  if (previousStatus !== doc.status) {
    setPreviousStatus(doc.status)
    setCompleted(false)
    setMenuRequested(false)
    setError('')
  }
  const actionable = doc.status === 'pending_approval' || doc.status === 'draft'
  const cancellable = actionable || doc.status === 'confirmed' || doc.status === 'active_borrow'
  const needsDueDate = actionable && doc.transaction_type === 'asset_borrow' && (!doc.due_date || doc.due_date < bangkokCalendarDate())
  const disabled = !actionable || busy || menuBusy || completed || (needsDueDate && !!borrowDueDateError(replacementDueDate))

  async function confirm() {
    if (disabled || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const result = await confirmDisbursement(doc.id, needsDueDate ? replacementDueDate : undefined)
      if (!result.ok) { setError(result.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'); return }
      setCompleted(true)
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { submitting.current = false; setBusy(false) }
  }

  return <>
    {needsDueDate && <div className="mb-2 whitespace-normal text-xs">
      <p>กำหนดส่งคืนเดิมพ้นกำหนดแล้ว กรุณายืนยันวันใหม่ก่อนอนุมัติ</p>
      <label htmlFor={dueInputId}>กำหนดส่งคืนใหม่</label>
      <input id={dueInputId} type="date" min={bangkokCalendarDate()} value={replacementDueDate} disabled={busy || completed} onChange={event => setReplacementDueDate(event.target.value)} className="mt-1 block h-8 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground" />
    </div>}
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5 [&>button]:h-8 [&>button]:rounded-lg [&>button]:px-2.5 [&>button]:text-xs', className)}>
      {actionable && <Button size="sm" variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" disabled={disabled} onClick={confirm}>{busy ? 'กำลังยืนยัน...' : 'ยืนยัน'}</Button>}
      {menuRequested
        ? <ApprovalRowMenu key={doc.status} doc={doc} disabled={busy || completed} onBusyChange={setMenuBusy} onComplete={() => { setCompleted(true); router.refresh() }} />
        : <Button variant="outline" size="sm" disabled={!cancellable || busy || menuBusy || completed}
            title={!cancellable ? 'รายการนี้ยกเลิกแล้ว หรือมีการรับคืนแล้ว' : undefined}
            onClick={() => setMenuRequested(true)}>ยกเลิก</Button>}

    </div>
    {error && <p role="alert" className="mt-1 whitespace-normal text-xs text-destructive">{error}</p>}
  </>
}
