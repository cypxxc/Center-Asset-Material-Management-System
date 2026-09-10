# Items performance follow-up

User approved the reviewed best-practice approach. No database operations or changes to pagination UX.

- Increase Items event coalescing to2500ms, retain750ms default elsewhere and5s maxwait. Serialize realtime refreshes using React transition completion, preserve events arriving during refresh, handle hidden tabs and cleanup. router.refresh does not return a completion Promise.
- Extract and dynamically load Inspector on demand. Preserve handlers, selection and printing. Print modal already dynamically loaded; do not duplicate it. Retain conditional render-time state synchronization rather than adding a redundant Effect.
- Existing migration00014 supplies six per-column GIN trigram indexes. Do not create duplicates. Live index presence/query plan remains unverified because DB access is outside scope.
- Preserve exact totals/page navigation and all sort options. Cursor pagination changes user-visible behavior and requires sort-specific cursors; do not introduce an incomplete replacement. Reduced realtime refreshes also reduce repeated data/count/signing requests.
- Compare Items initial client entry file union before/after from production manifests, run targeted interaction/controller tests, full tests/lint/build and independent review.
