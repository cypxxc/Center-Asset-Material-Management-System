# Completed borrowing and issue chart

Approved in conversation: add a Dashboard chart of successful borrowing and issue documents, measured in transactions, split by type with a combined total. Monthly buckets support calendar/fiscal years and an accessible data table.

Count one document, regardless of its number of lines, only after `handed_over_at` exists. Include `material_issue` and `asset_handover` as issues in `confirmed`; include `asset_borrow` in `active_borrow`, `partially_returned`, or `returned`. Exclude approval-only, draft, rejected, cancelled and reversed documents. Bucket by physical handover in Asia/Bangkok; never substitute approval/creation dates. A returned loan remains counted once at its original handover.

Use user-scoped SQL aggregation with existing RLS; totals reflect the documents the user may see. No changes to database records, permissions, schema, or transaction workflows. Explain missing handover dates rather than inventing dates.

Approach: a dedicated stacked monthly bar chart shares existing semantic tokens and year-series logic. Reusing the inventory chart verbatim would mislabel counts as registry items and introduce unrelated value/forecast controls. Count document headers without joining item lines to prevent duplication. Keep existing inventory charts intact.

2026-11-17 follow-up: user requested the most appropriate chart after discussing donut versus time-series options. Retain stacked columns to compare monthly totals and their borrowing/issue components. Open the latest calendar year with completed activity (current year if there is no activity), retain all-year and fiscal filters, show monthly total labels above columns, and distinguish zero activity from future months. Increase emphasis on the combined total; keep the counting rules unchanged. Six focused component/series tests, scoped ESLint and strict TypeScript checks passed after this refinement.
