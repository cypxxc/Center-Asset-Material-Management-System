# Import forms design and plan

User clarified two separate forms: asset import and material import, selected from one dropdown under the existing Settings import heading. Preserve asset template and CSV/Excel flow. Material form accepts the four original FY2570 workbooks (one or multiple), reads only the summary and verifies source detail, preserves source values, and shows filename/count/zero balances/value/date before explicit submission. No data is saved on file selection. Changing mode clears stale forms; prevent changes during import. Reuse existing authorized Server Action and duplicate/zero protection.

1. Extract browser-safe shared material reader; regression tests for source preservation and invalid files.
2. Separate asset and material forms and add the two-option dropdown; UI tests for selection and explicit submission.
3. Validate all four original files; focused tests, typecheck, lint, independent review. No live imports during verification.

Final verification: 11 focused tests passed; typecheck and full lint passed. Browser harness with mocked actions previewed the actual four workbooks (76 records,42zero,38776), checked both forms on desktop/mobile with no horizontal overflow. No live import. Review found incomplete date validation; fixed to require source year69/2569 and regression passes. Prior full build remains blocked by running standalone DLL lock; do not terminate user server.

Latest user steering implemented: shared standard18column template for both forms, with type-specific sample rows. Material accepts standardCSV/XLSX and originalledgerXLSX. Standard workbook path bypasses legacy converter's fixed quantity1. CSV parser now handles embedded newlines/escapedquotes and rejects malformed quotes. Missing/placeholder material stock rejected; unknown valuation stays unavailable. Unknown/duplicate columns are rejected to avoid silent loss. 17focusedtests passed; source snapshot validated76/42zero/38776 through shared path. No live import.
