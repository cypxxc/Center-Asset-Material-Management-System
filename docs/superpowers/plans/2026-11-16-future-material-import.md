# Future material imports

The import screen must accept future additions rather than depending on the initial migration files. Keep the existing general Excel/CSV template for arbitrary new inventory. Retain the legacy ledger layout as an additional supported format; remove its fixed fiscal year, balance date and category restrictions. Do not guess arbitrary spreadsheet layouts or update existing stock implicitly. Duplicate materials remain rejected.

Implementation and validation:

1. Add synthetic tests for a future fiscal year, a new category, actual balance dates, invalid dates, provenance duplicates and independent template additions. Verify failures before changing production code.
2. Read the ledger year and balance date from the workbook, preserve existing provenance keys and generate distinct keys for new categories. Generalize duplicate provenance matching.
3. Display the actual date for each file and explain the supported template and ledger formats in the import guide.
4. Run focused import tests, TypeScript checks and ESLint. Review changes without touching existing database records or unrelated workspace changes.
