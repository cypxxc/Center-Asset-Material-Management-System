# Material issue implementation

Implements the approved spec in ../specs/2026-11-16-material-disbursement-business-rules.md in the existing dirty workspace, preserving unrelated changes.

1. Add tests for available quantities and material eligibility. Implement a shared SQL pending-material quantity projection and server assertion, reusing sorted item advisory locks. Keep asset reservation and central checks unchanged.
2. Wire create/update/confirm/catalog submission. Add bounded quantities to catalog requests; enforce per-item exclusion for self reservations and atomic guarded deduction. Cancellation/rejection release reservations through status; reversal keeps existing once-only guards.
3. Update catalog and picker to show physical/reserved/available quantities and accept integer material quantities; disallow mixed asset/material carts. Refresh materials on mutations.
4. Verify unit/schema/component tests and PostgreSQL rollback lifecycle + concurrent requests. Run TypeScript, lint, build and full test command. Independent review before completion.

Constraints: no RBAC/RLS/formula changes, no direct changes to existing application records. Use nullable-price semantics and existing stock movement logging. Reservations derive from existing pending documents.

Ruling: existing database trigger also enforced whole-item exclusivity, so migrations 0007/0008 update the trigger for materials and leave drafts unreserved. No new tables or columns. Both migrations applied locally; no backfill. Missing this trigger change would reject otherwise valid concurrent partial requests.

Ruling: real multi-user concurrency needs committed temporary UUID fixtures, because PostgreSQL hides uncommitted rows from other connections. The opt-in concurrency test creates only its own profiles/material/documents and removes them in finally. Cleanup uses owner-only SET LOCAL session_replication_role inside its transaction because even pending headers prohibit deletion; all predicates are scoped to generated fixture UUIDs. Approval is exclusively in rollback fixtures to avoid consuming application document numbers. Earlier exploratory runs included committed approval and consumed sequence numbers; fixture data was removed, but the sequence was not rewound because doing so could collide with real approvals. Final test no longer performs committed approval.

Review focus: self reservation exclusion; stale stock; duplicate submit; partial document rollback; materials without central flag; asset regression; multi-user contention; null price; unknown/deleted items; negative/overflow quantities.

## Completion evidence

- Implemented material pending-quantity sums, self-document exclusion, advisory serialization, bounded request quantities, guarded stock deductions and material-only central bypass. Assets retain central/exclusive reservation rules.
- Catalog displays physical/reserved/available stock, accepts per-material quantities, prevents mixed carts and material borrowing, and rejects stale/unavailable selections. Draft picker/form display stock and reservations alongside available quantity. Mutation invalidation includes /materials.
- Migrations 0007 and 0008 applied successfully. No new data columns or RLS/RBAC changes.
- Five focused unit/component tests passed, including quantity controls and disabled borrow mode for materials.
- Two PostgreSQL tests passed: rollback lifecycle (drafts, pending sums, self exclusion, cancellation/rejection, stale stock, approval/reversal duplicate guards, null-price snapshots, atomic multi-line rollback, spare/damaged states, asset central and reservation regression); real two-user concurrent requests for 4+4 from physical5 (one success, one rejection, remaining1 still requestable).
- TypeScript with unused checks, ESLint and production build passed. Bundle budget passed.
- Full npm test stops at existing components/ui/image-crop-dialog.test.tsx React-is-not-defined failures. The separately run schema suite also has unrelated existing failures in `returnItemSchema validates condition and positive quantity` and `disbursement RBAC permissions enforce admin vs viewer access`; permissions/return semantics were not changed to satisfy stale expectations.
- Independent read-only review complete; important draft/concurrency test findings addressed. Prior exploratory sequence-number consumption is documented above and must be disclosed; no sequence rewind performed.
- Visual checks used DOM component tests; no manual browser flow was run. New test/plan files match existing ignore rules and remain available in this workspace; .gitignore was not changed.
