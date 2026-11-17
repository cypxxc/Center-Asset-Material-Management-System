# Material import implementation plan

**Goal:** Prepare FY2570 data and make snapshot import safe.
**Architecture:** Reusable pure quantity/duplicate validation, existing import transaction, read-only workbook preparation CLI, review artifacts. No schema changes.
**Tech Stack:** TypeScript, existing ExcelJS reader, Postgres/Drizzle, artifact-tool review workbook.
**Spec:** ../specs/2026-11-16-material-import-design.md

- [x] Add failing quantity/schema/duplicate tests; implement strict parsing and duplicate guards.
- [x] Build preparation CLI; preserve source keys, reconcile cached values and ledger rows, flag ambiguities, generate CSV/JSON.
- [x] Author review workbook; verify counts and totals against original files.
- [x] Exercise actual import on disposable local test DB inside rollback transaction; verify repeat guard and no lasting changes.
- [x] Focused tests, lint, typecheck, code review; report remaining cutover/unit decisions.

User clarified: preserve all original values, no conversions or renaming. Source values independently verified. Live database not imported because authenticated admin browser session is unavailable; prepared CSV uses the existing Settings import flow. Full test/build baseline blockers recorded in material-import README.
