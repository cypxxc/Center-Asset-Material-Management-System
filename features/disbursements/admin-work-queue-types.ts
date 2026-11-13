import type { DisbursementTransactionType } from './types'

export interface AdminWorkQueueItem {
  id: string
  document_no: string | null
  recipient_name: string
  department_name: string
  kind: 'overdue' | 'pending'
  transaction_type: DisbursementTransactionType
  purpose: string
  due_date: string | null
  overdue_days: number
  created_at: string
}

export interface AdminWorkQueueSummary {
  asOf: string
  pendingCount: number
  overdueCount: number
  items: AdminWorkQueueItem[]
}
