# Items Infinite Scroll Implementation Plan

> **For agentic workers:** Use subagent-driven-development; follow the task brief and report each task independently.

**Goal:** Continuous bounded scrolling for CAMMS items.
**Architecture:** Authenticated cursor batch endpoint, virtualized client window and bounded navigation restoration.
**Tech Stack:** Installed Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, node:test.
**Spec:** ../specs/2026-09-22-items-infinite-scroll-design.md

## Global Constraints
- Batch size 25; active record window at most 500.
- Both backends, existing roles and mutation behavior preserved.
- No external writes or production fixtures; no new dependencies unless justified.
- Read installed Next.js docs before framework code changes.

### Task 1: Cursor data access
Files: features/items/{types.ts,cursor.ts,cursor.test.ts,queries.ts,postgres-queries.ts}, app/api/items/batch/route.ts and focused tests.
Interface: `getItemBatch(params: ItemListSearchParams, cursor?: string): Promise<ItemBatchResult>`; result `{items: ItemListRow[], total: number | null, nextCursor: string | null}`. First batch supplies total, subsequent batches may return null. Cursor encodes validated sort key/value/id and filter identity; limit is fixed at 25, query asks 26 for has-more. Legacy getItems remains compatible.
- [ ] Test cursor round trips, invalid/filter-mismatched cursors, tied sorts, parameter escaping and batch bounds.
- [ ] Implement shared sort/cursor validation and both keyset queries, exact count only for initial batch, image signing only returned rows.
- [ ] Add authenticated no-store GET /api/items/batch; query uses existing filter keys and cursor. Return 400 malformed cursor, 401/403 invalid user and generic 500 on failures.
- [ ] Run focused tests and report.

### Task 2: Continuous client
Files: items page/explorer, focused new hooks and virtualized view modules under features/items, component tests.
Consumes Task 1 interface. Initial page passes batch and user identity to client. Preserve existing inspector/action behavior.
- [ ] Test single-flight fetch, stale response discard, retry, end state, append deduplication, bounded retention and back restoration.
- [ ] Build bounded batch window hook and list/grid virtualization, automatic near-end loading and fallback controls.
- [ ] Integrate initial server page, cursor/filter reset, view/position restoration and clear selection labels.
- [ ] Run relevant tests and report.

### Task 3: Integration and review
- [ ] Independently review each task and resolve correctness findings.
- [ ] Run full tests, typecheck, lint, build, diff check and safe browser checks.
- [ ] Broad final independent review; report actual outcomes and remaining limitations.
