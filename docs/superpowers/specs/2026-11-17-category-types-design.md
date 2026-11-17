# Separate material and asset categories

Approved by the user: retain one categories table, assign each category an `item_type` (`asset` or `material`), show only matching choices, and separate settings into two tabs. Enforce matching types on writes, including imports and bulk updates.

## Approaches
Use one typed table (selected) to preserve the existing metadata workflow. Separate tables would duplicate settings and reference logic. Filtering by current usage alone cannot classify empty/new categories.

## Existing data
Keep IDs for asset categories and categories used only by materials. Reclassify material-only categories; clone categories used by both types and repoint every material reference, including archived records. Unused categories remain asset categories because the previous settings label explicitly described asset categories. Names may repeat across types, but remain unique within one type. Preserve names, metadata, audit history, permissions, stock and depreciation behavior.

Migration is transactional and must lock category and inventory tables. Composite foreign keys enforce the category/type pair, including direct database writes. Do not run migrations against the user's live database in this task; verify in a disposable database if available.

## Scope
Settings, shared references, forms, filters, sidebar, reports, imports, bulk writes and backup column policy. Preserve existing uncommitted work. No deployment or unrelated cleanup.
