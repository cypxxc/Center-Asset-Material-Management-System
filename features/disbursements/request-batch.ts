import { createHash } from 'node:crypto'

type CartInput = {
  item_ids: string[]; quantities?: Record<string, number>; item_actions?: Record<string, 'issue' | 'borrow'>
  request_type?: 'issue' | 'borrow'; due_date?: string | null; purpose: string
}

export function requestFingerprint(input: CartInput): string {
  const payload = {
    items: [...input.item_ids].sort().map(id => ({ id, quantity: input.quantities?.[id] ?? 1, action: input.item_actions?.[id] ?? input.request_type ?? 'borrow' })),
    due_date: input.due_date ?? null, purpose: input.purpose.trim(),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function batchSummary(statuses: string[]): string {
  if (!statuses.length) return 'ไม่มีเอกสาร'
  if (statuses.every(s => s === 'pending_approval')) return 'รออนุมัติ'
  if (statuses.every(s => ['returned', 'reversed', 'cancelled', 'rejected'].includes(s))) return 'สิ้นสุดแล้ว'
  if (new Set(statuses).size > 1) return 'ดำเนินการบางส่วน'
  return statuses[0] === 'confirmed' ? 'อนุมัติแล้ว' : statuses[0] === 'active_borrow' ? 'อยู่ระหว่างยืม' : 'อยู่ระหว่างดำเนินการ'
}
