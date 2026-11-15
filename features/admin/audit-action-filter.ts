import { sql } from 'drizzle-orm'

// Audit events already written by the disbursement workflow.
const APPROVAL_ACTIONS = [
  'confirm_disbursement',
  'reject_borrow_request',
  'cancel_disbursement_draft',
  'withdraw_disbursement_request',
  'reverse_disbursement',
  'return_disbursement_item',
]

export function buildAuditActionFilter(action?: string) {
  if (!action || action === 'all') return undefined
  if (action === 'approval_history') {
    return sql`lower(a.action) in (${sql.join(APPROVAL_ACTIONS.map(value => sql`${value}`), sql`, `)})`
  }
  return sql`lower(a.action) = ${action.toLowerCase()}`
}
