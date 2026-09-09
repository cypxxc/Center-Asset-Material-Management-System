# Items and Reports Implementation Plan

**Goal:** Bound query payloads and export memory while preserving user workflows.
**Spec:** ../specs/2026-09-09-items-reports-performance.md
**Execution:** subagent-driven-development for independent Items/realtime tasks, root Reports integration, independent final review.

- [ ] Items: add request-level tests for head count vs 10-row data and one batch signing call; implement shared filters, separate timings and stable sorting; document existing index validation.
- [ ] Realtime: fake-timer lifecycle tests for burst, hidden tab, visibility flush and cleanup; implement 750ms coordinator.
- [ ] Reports: failing tests for RPC errors and >5000 results, replace unbounded fallback with validated bounded RPC batches and PDF maximum. Update RPC to bound payload, cap page size and stabilize sorting. Stream XLSX from route with auth, limiter, abort and backpressure; update UI and visible errors.
- [ ] Validation: generated workbook row/totals checks, migration SQL test in PGlite, route guard tests; full test suite, typecheck, lint, build, review, documentation and local commit.

Rollout: apply new report migration before app deployment. Previous security limiter migration remains a prerequisite.
