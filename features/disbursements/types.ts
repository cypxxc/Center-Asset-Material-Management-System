export type DisbursementTransactionType = 'material_issue' | 'asset_handover' | 'asset_borrow'

export type DisbursementStatus =
  | 'draft'
  | 'confirmed'
  | 'active_borrow'
  | 'partially_returned'
  | 'returned'
  | 'reversed'
  | 'cancelled'

export type DisbursementLineStatus =
  | 'pending'
  | 'issued'
  | 'partially_returned'
  | 'returned'
  | 'reversed'

export type ItemCondition = 'normal' | 'damaged' | 'lost'

export interface DisbursementRow extends Record<string, unknown> {
  id: string
  document_no: string | null
  fiscal_year: number | null
  transaction_type: DisbursementTransactionType
  recipient_name: string
  department_name: string
  purpose: string
  status: DisbursementStatus
  due_date: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  reversal_reason: string | null
  reversed_at: string | null
  reversed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DisbursementItemRow extends Record<string, unknown> {
  id: string
  disbursement_id: string
  item_id: string
  requested_qty: number
  issued_qty: number
  returned_qty: number
  item_name_snapshot: string | null
  asset_no_snapshot: string | null
  serial_no_snapshot: string | null
  brand_snapshot: string | null
  model_snapshot: string | null
  unit_name_snapshot: string | null
  unit_price_snapshot: number | null
  category_name_snapshot: string | null
  location_name_snapshot: string | null
  status: DisbursementLineStatus
}

export interface StockMovementRow extends Record<string, unknown> {
  id: string
  item_id: string
  disbursement_item_id: string | null
  delta: number
  balance_after: number
  movement_type: 'issue' | 'reversal' | 'adjust_audit'
  created_by: string | null
  created_at: string
}

export interface AssetCustodyLogRow extends Record<string, unknown> {
  id: string
  item_id: string
  disbursement_item_id: string
  action: 'handover' | 'borrow' | 'return' | 'reversal'
  quantity: number
  from_responsible: string | null
  to_responsible: string | null
  item_condition: ItemCondition
  note: string | null
  created_by: string | null
  created_at: string
}

export interface DisbursementListResult {
  items: DisbursementRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DisbursementSelectableItem {
  id: string
  item_name: string
  item_type: 'material' | 'asset'
  asset_no: string | null
  serial_no: string | null
  quantity: number
  category?: { id: string; name: string } | null
  unit?: { name: string } | null
}

