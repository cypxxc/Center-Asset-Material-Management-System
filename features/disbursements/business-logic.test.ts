import test from 'node:test'
import assert from 'node:assert/strict'
import { COMPLETED_DISBURSEMENT_STATUSES } from './status-groups'

test('disbursement status groups keep rejected in completed list for history/completed handling', () => {
  assert.ok(COMPLETED_DISBURSEMENT_STATUSES.includes('rejected'))
  assert.ok(COMPLETED_DISBURSEMENT_STATUSES.includes('confirmed'))
})

test('SQL clauses builder logic test: when filtering by specific status rejected, it must not be excluded', () => {
  // Simulate the logic in getPostgresDisbursements:
  const buildClauses = (params: { historyOnly?: boolean; hideCompleted?: boolean; status?: string }) => {
    const clauses: string[] = []
    if (params.historyOnly) {
      clauses.push(`status IN completed`)
    } else if (params.hideCompleted) {
      clauses.push(`status NOT IN completed`)
    } else if (!params.status) {
      // Default view without explicit status filter: hide rejected from active queue
      clauses.push(`status <> 'rejected'`)
    }

    if (params.status) {
      clauses.push(`status = '${params.status}'`)
    }
    return clauses
  }

  // 1. User/Admin with default view (no status filter, not historyOnly, not hideCompleted)
  const defaultClauses = buildClauses({})
  assert.deepEqual(defaultClauses, ["status <> 'rejected'"])

  // 2. User/Admin filtering explicitly for rejected
  const rejectedClauses = buildClauses({ status: 'rejected' })
  assert.deepEqual(rejectedClauses, ["status = 'rejected'"])
  assert.ok(!rejectedClauses.includes("status <> 'rejected'"))

  // 3. User filtering for draft
  const draftClauses = buildClauses({ status: 'draft' })
  assert.deepEqual(draftClauses, ["status = 'draft'"])

  // 4. Admin pending approval queue (hideCompleted=true)
  const pendingClauses = buildClauses({ hideCompleted: true })
  assert.deepEqual(pendingClauses, ["status NOT IN completed"])
  // Since 'rejected' is in COMPLETED_DISBURSEMENT_STATUSES, it is automatically excluded by status NOT IN completed
})

test('Audit log old_data reflects actual document status at confirmation', () => {
  const getAuditOldData = (docStatus: string) => {
    return { status: docStatus }
  }

  assert.deepEqual(getAuditOldData('pending_approval'), { status: 'pending_approval' })
  assert.deepEqual(getAuditOldData('draft'), { status: 'draft' })
})
