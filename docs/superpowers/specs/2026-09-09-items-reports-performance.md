# Items and Reports performance

Approved by user in conversation (confirm).

- Preserve Items filters, substring search and exact page totals. Existing pg_trgm indexes must not be duplicated. Split bounded data and head-only exact-count queries for separately labeled timings; document EXPLAIN checks rather than claim unmeasured production speedups.
- Batch sign unique image object paths once per list request, using the user's storage permissions; no shared signed-URL cache.
- Realtime: debounce 750 ms, no immediate redundant mount refresh, defer while hidden and flush once visible. Clean listeners/timers/subscriptions on unmount.
- Reports page must use a bounded PostgreSQL query and fail visibly when RPC fails; remove unbounded JS sorting/aggregation fallback. Remove full overdue array from page payload.
- Excel: authenticated, rate-limited server download, batch size 500–1000, incremental XLSX writer with committed rows and bounded backpressure. No giant Server Action JSON or full workbook buffer. Preserve columns, Thai labels, totals, filters, and ordering; stable ID tiebreaker. Streaming errors must abort the file rather than complete a partial workbook. Cancel database work when download is cancelled.
- PDF: retain browser rendering up to 5000 records; explicitly reject larger matches and recommend Excel. Fetch bounded batches and never silently truncate.
- Query limits and RLS must remain effective. SQL migrations are prepared locally, never silently applied to remote databases. Export is a live multi-query read, not a transaction-wide snapshot; detect count mismatches and document concurrent-edit limitation.
- Tests cover >5000 records, batch errors, incomplete responses, PDF bound, authenticated/limited download, realtime visibility and signing call counts. Validate TypeScript, lint, full tests and build. Inspect resulting XLSX with ExcelJS.
