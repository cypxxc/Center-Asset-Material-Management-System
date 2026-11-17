'use client'

import { useEffect, useState } from 'react'
import { Clock, Bell } from 'lucide-react'
import { pendingApprovalTracking, type DisbursementTrackingFields } from '../tracking'

export function PendingApprovalIndicator({ doc, slaHours = null, now }: { doc: DisbursementTrackingFields; slaHours?: number | null; now?: string }) {
  // Render the same placeholder on server and first client render; age then refreshes each minute.
  const [currentTime, setCurrentTime] = useState<string | null>(now ?? null)
  useEffect(() => {
    if (now) return
    const update = () => setCurrentTime(new Date().toISOString())
    const initial = window.setTimeout(update, 0)
    const timer = window.setInterval(update, 60_000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [now])
  if (doc.transaction_type !== 'material_issue' || doc.status !== 'pending_approval') return null
  const tracking = currentTime ? pendingApprovalTracking(doc, slaHours, new Date(currentTime)) : null
  const overdue = tracking?.overdue ?? false
  const Icon = overdue ? Bell : Clock
  return <span className={`mt-1 flex items-start gap-1 text-xs ${overdue ? 'font-semibold text-amber-800' : 'text-muted-foreground'}`}>
    <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{overdue ? 'รออนุมัติ · เกินเวลาติดตาม' : 'รออนุมัติ'}{tracking ? ` · ${tracking.ageHours.toLocaleString('th-TH', { maximumFractionDigits: 1 })} ชั่วโมง` : ''}
      {overdue && <> (กำหนด {tracking?.slaHours?.toLocaleString('th-TH')} ชั่วโมง)</>}
    </span>
  </span>
}
