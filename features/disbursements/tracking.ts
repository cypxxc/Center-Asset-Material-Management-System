export interface DisbursementTrackingFields {
  transaction_type: string
  status: string
  created_at: string
  submitted_at?: string | null
  confirmed_at?: string | null
  handed_over_at?: string | null
  handed_over_by?: string | null
}

/** An unset/invalid setting disables the deadline; there is no implicit SLA. */
export function parseMaterialApprovalSlaHours(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function pendingApprovalTracking(doc: DisbursementTrackingFields, slaHours: number | null, now = new Date()) {
  if (doc.transaction_type !== 'material_issue' || doc.status !== 'pending_approval') return null
  const started = new Date(doc.submitted_at || doc.created_at).getTime()
  if (!Number.isFinite(started)) return null
  const ageHours = Math.max(0, (now.getTime() - started) / 3_600_000)
  const configured = slaHours != null && Number.isFinite(slaHours) && slaHours > 0 ? slaHours : null
  return { ageHours, overdue: configured != null && ageHours >= configured, slaHours: configured }
}

export function handoverDecision(doc: Pick<DisbursementTrackingFields, 'transaction_type' | 'status' | 'handed_over_at'>): 'mark' | 'existing' {
  if (doc.handed_over_at) return 'existing'
  const approved = (['material_issue', 'asset_handover'].includes(doc.transaction_type) && doc.status === 'confirmed') ||
    (doc.transaction_type === 'asset_borrow' && doc.status === 'active_borrow')
  if (!approved) throw new Error('บันทึกส่งมอบได้เฉพาะเอกสารที่อนุมัติแล้วและยังไม่มีการรับคืน')
  return 'mark'
}
