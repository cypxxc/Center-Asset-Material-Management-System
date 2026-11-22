'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { markDisbursementHandover } from '../tracking-actions'
import { handoverDecision, type DisbursementTrackingFields } from '../tracking'
import type { DisbursementRow } from '../types'
import { PendingApprovalIndicator } from './tracking-pending-indicator'

function timestamp(value: string | null | undefined) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'ยังไม่มีข้อมูล'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
}

export function DisbursementTracking({ doc, canManage, slaHours = null }: { doc: DisbursementRow; canManage: boolean; slaHours?: number | null }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [recorded, setRecorded] = useState<{ id: string; at: string } | null>(null)
  const submittedAt = typeof doc.submitted_at === 'string' ? doc.submitted_at : null
  const handedOverAt = recorded?.id === doc.id ? recorded.at : typeof doc.handed_over_at === 'string' ? doc.handed_over_at : null
  const tracking: DisbursementTrackingFields = { ...doc, submitted_at: submittedAt, handed_over_at: handedOverAt }
  let canMark = false
  try { canMark = canManage && handoverDecision(tracking) === 'mark' } catch { /* Approval is required. */ }

  async function markHandover() {
    setPending(true)
    setMessage('')
    try {
      const result = await markDisbursementHandover(doc.id)
      setFailed(!result.success)
      setMessage(result.message ?? '')
      if (result.success && result.data) {
        setRecorded({ id: doc.id, at: result.data.handed_over_at })
        setConfirmOpen(false)
        router.refresh()
      }
    } catch {
      setFailed(true)
      setMessage('ติดต่อระบบไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง')
    } finally { setPending(false) }
  }

  return <section aria-label="ติดตามคำขอและการได้รับของ" className="space-y-3 rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold text-foreground">ติดตามคำขอและการได้รับของ</h2>
    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
      <div><dt className="text-muted-foreground">ส่งคำขอ</dt><dd className="mt-1 text-foreground">{timestamp(submittedAt)}</dd></div>
      <div><dt className="text-muted-foreground">อนุมัติ</dt><dd className="mt-1 text-foreground">{timestamp(doc.confirmed_at)}</dd></div>
      <div><dt className="text-muted-foreground">ผู้รับได้รับของเมื่อ</dt><dd className="mt-1 text-foreground">{timestamp(handedOverAt)}</dd></div>
    </dl>
    <PendingApprovalIndicator doc={tracking} slaHours={slaHours} />
    {doc.transaction_type === 'material_issue' && doc.status === 'pending_approval' && <p className="text-xs text-muted-foreground">ตัดยอดวัสดุแล้วระหว่างรออนุมัติ ยังไม่ใช่หลักฐานการอนุมัติหรือการได้รับของ{slaHours == null ? ' · ยังไม่ได้กำหนดเวลาติดตาม' : ''}</p>}
    {canMark && <Button aria-busy={pending} type="button"  size="sm" disabled={pending} onClick={() => setConfirmOpen(true)} className="gap-1.5">บันทึกได้รับของแล้ว</Button>}
    {message && <p role={failed ? 'alert' : 'status'} className={`text-xs ${failed ? 'text-destructive' : 'text-foreground'}`}>{message}</p>}
    <ConfirmDialog open={confirmOpen} title="ยืนยันผู้รับได้รับของแล้ว" description="ยืนยันว่าผู้รับได้รับสิ่งของตามเอกสารนี้ครบแล้ว ระบบจะบันทึกเวลาและผู้บันทึกเพื่อเป็นหลักฐานการได้รับของ" confirmText="ยืนยันได้รับของแล้ว" onConfirm={markHandover} onCancel={() => { if (!pending) setConfirmOpen(false) }} isPending={pending} />
  </section>
}
