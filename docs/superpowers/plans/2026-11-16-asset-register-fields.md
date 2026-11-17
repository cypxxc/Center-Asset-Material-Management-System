# Asset register coverage

User request: complete the asset entry form against the 2570 register and show the data in item detail.

Design: add optional register sequence, asset prefix, accumulated depreciation, book value and accounting date. Keep recorded accounting amounts independent of calculated depreciation. Allow free-text custodians with suggestions. Keep the existing asset identifier unchanged for compatibility. Show the additional fields in the existing Inspector (the item URL currently redirects to the registry).

Use typed nullable columns on assets, exposed through the inventory view with NULL values for materials. No permission or depreciation formula changes, no backfill of existing records. Prepare a forward-only migration, including Drizzle snapshot. Existing unrelated workspace changes must be preserved.

1. Add failing validation and conversion tests: blank vs zero, negative amounts, sequence/prefix preservation and official workbook accounting columns.
2. Implement shared field metadata/schema, form parsing, inserts/updates, types and read projections. Generate migration and append inventory-view fields without changing existing order.
3. Add optional register inputs and a details component; allow custodians outside the user list. Wire official Excel conversion and import persistence for these fields.
4. Run targeted tests, typecheck/lint and project tests. Review diff and verify migration against an isolated database if available. Do not alter application records.

Review focus: missing fields in old requests; zero accounting values; materials unaffected; old records remain editable; multiple asset-number columns retain existing identifier semantics.

Completed: migration 0006 generated and applied locally. Original workbook contains signed accumulated depreciation (-13,999); preserve that sign rather than enforce nonnegative accumulated amounts. Book value remains nonnegative. Older forms preserve omitted register fields, while explicit blanks clear them. Existing combined asset identifiers remain unchanged.

Validation: 20 targeted tests passed; PostgreSQL create/edit/import/list/batch/material tests passed with rolled-back fixtures; TypeScript, ESLint and production build passed. Actual workbook: 900 converted records, 36 columns, no register validation failures. Full npm test stops on the preexisting React-is-not-defined failures in components/ui/image-crop-dialog.test.tsx. Workspace diff whitespace check reports CRLF/trailing-whitespace issues across existing changes; no broad reformatting performed. Independent read-only review found no remaining important issues.
