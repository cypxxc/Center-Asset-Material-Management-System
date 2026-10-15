# Items continuous scrolling

Approved direction: user's 2026-09-22 request to implement the preceding infinite-scroll proposal using subagents.

Load 25 items initially and fetch successive batches near the end of the scroll area. Preserve table/grid views, filters, sorting, item inspector, editing, export, roles and bulk actions. Show loaded/total progress, explicit load-more fallback, retry and end states. Use stable keyset pagination with an ID tie-breaker for all supported sorts. Do not reuse a cursor across filters/sorts. Authenticate the read endpoint and keep database access user-scoped on both supported backends.

Virtualize rendered list/grid rows. Keep at most 500 item records in the active client window; retain small batch cursors to reload evicted records when scrolling back. Bound navigation restoration to a single in-memory snapshot per user and filter, with a short TTL; never persist item records to localStorage. Back navigation should restore the loaded window, view and scroll offset. Refresh/filter changes invalidate stale pending responses; filters reset the list, refresh should refresh the visible window without joining incompatible generations. Selection labels distinguish loaded items from all matches. Existing all-match bulk operations retain permission and validation checks.

No production mutations, migrations or deployment. Validate with query/unit/component tests, typecheck, lint, build and safe browser checks where authentication is available. No claim of measured production speed without measurements.
