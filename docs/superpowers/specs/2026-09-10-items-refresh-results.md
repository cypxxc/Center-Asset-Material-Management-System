# Items performance follow-up results

## Changes
- Items coalesces realtime changes for2500ms (other consumers keep750ms). Maximum wait remains5s while idle/visible. An in-flight realtime refresh blocks another; queued events produce a coalesced follow-up after completion. Actual completion follows React transition pending true-to-false, not a Promise from router.refresh. Hidden tabs defer work and cleanup cancels callbacks.
- Inspector now loads only when opened. Loading has an accessible status; parent Escape handling can cancel opening before the chunk resolves. Close/backdrop/edit/print behavior is preserved.
- Twelve controller/transition tests cover bursts, continuous events, busy/hidden/cleanup and failure recovery. Nine Inspector tests include cold-load Escape cancellation and normal actions. Independent review caught the loading Escape gap and confirmed its repair.

## Deliberately retained behavior
Exact count, numbered pagination and all sort options remain compatible. Fewer event-triggered refreshes also mean fewer repeated count/data/signing calls under bursty updates; this does not eliminate count cost on navigation. Cursor pagination requires a product choice about random page access and sort-specific cursors.

Migration00014 already defines six per-column trigram indexes matching current search fields. No duplicate index migration was added. No live database access or index-plan verification was performed. Conditional prop/state synchronization was retained rather than replaced with an Effect that could add stale renders.

## Measurement
Baseline Items client entry-file union from production manifest:399760raw bytes,112865gzip bytes across12files. After:380172raw bytes,108218gzip bytes across12files. Reduction:19588raw bytes (4.9%) and4647gzip bytes (4.1%). Same toolchain/build mode used for comparison; this measure includes shared entries and is not a browser timing or RES prediction.

Final lint/typecheck/production build passed. The existing dashboard integration test assumed direct cleanup return and was updated for the transition-completion cleanup wrapper; its five tests pass. Full-suite execution resumes from that repaired test rather than rerunning already-passed files without implementation changes.

Completed verification across both batches:117 unique test files,487 passing tests,zero remaining failures. All implementation code was unchanged between the batches; only the outdated structural assertion was repaired.

## Limits
Changes are local until deployed. Production backend Auth/profile/data delays and live query plans still require field validation. No database changes, fabricated timing improvement or claim that all performance bottlenecks have disappeared.
