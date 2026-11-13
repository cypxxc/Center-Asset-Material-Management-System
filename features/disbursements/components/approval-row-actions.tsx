'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { confirmDisbursement } from '../actions'
import type { DisbursementRow } from '../types'

const ApprovalRowMenu = dynamic(() => import('./approval-row-menu').then(module => module.ApprovalRowMenu), {
  ssr: false,
  loading: () => <Button variant="outline" size="sm" disabled aria-busy="true">กำลังโหลด...</Button>,
})

export function ApprovalRowActions({ doc, className }: {
  doc: Pick<DisbursementRow, 'id' | 'status' | 'recipient_name' | 'transaction_type' | 'purpose'>
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [menuBusy, setMenuBusy] = useState(false)
  const [menuRequested, setMenuRequested] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
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
  const disabled = !actionable || busy || menuBusy || completed

  async function confirm() {
    if (disabled || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const result = await confirmDisbursement(doc.id)
      if (!result.ok) { setError(result.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'); return }
      setCompleted(true)
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { submitting.current = false; setBusy(false) }
  }

  return <>
    <div className={cn('flex items-center justify-end gap-2', className)}>
      {actionable && <Button size="sm" disabled={disabled} onClick={confirm}>{busy ? 'กำลังยืนยัน...' : 'ยืนยัน'}</Button>}
      {menuRequested
        ? <ApprovalRowMenu key={doc.status} doc={doc} disabled={busy || completed} onBusyChange={setMenuBusy} onComplete={() => { setCompleted(true); router.refresh() }} />
        : <Button variant="outline" size="sm" disabled={!cancellable || busy || menuBusy || completed}
            title={!cancellable ? 'รายการนี้ยกเลิกแล้ว หรือมีการรับคืนแล้ว' : undefined}
            onClick={() => setMenuRequested(true)}>ยกเลิก</Button>}

    </div>
    {error && <p role="alert" className="mt-1 whitespace-normal text-xs text-destructive">{error}</p>}
  </>
}
