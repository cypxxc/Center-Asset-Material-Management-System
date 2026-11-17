# Separate material inventory

User request: store materials in a physical table based on the supplied office-material workbook, separate from assets, with distinct sidebar destinations. Future imports use file headings rather than filenames or fixed dates.

Decision: physical `materials` and existing asset `items`; a security-invoker `inventory_items` union is read-only for shared reporting. An identity-only `inventory_registry` preserves globally unique inventory UUIDs and existing disbursement/stock foreign-key contracts. This avoids dual nullable transaction parents while keeping business data in exactly one physical table. Writers resolve the registry type and lock the physical table; never lock/update the union. Types cannot change in place.

Council: Architect favors full separation with preserved history; Skeptic and Pragmatist agree, Critic favors staged separation unless migration reconciliation and authorization are rehearsed. Strongest dissent: a partial split silently forks stock and breaks locks. Resolution: transactional migration and disposable PostgreSQL tests before cutover. Registry is a builder decision replacing dual references to minimize changes to immutable transaction history.

Workbook fields: name, specification, category, commodity code, unit, minimum/maximum, opening quantity/value, received quantity/value, issued quantity/value, balance quantity/unit price/value, fiscal year and balance date. Imported ledger quantities/value are dated source snapshots; current quantity remains the stock authority and movements remain append-only. Capture source fields in typed columns, not only notes. Do not fabricate missing numeric amounts.

Navigation: assets under `/items`, materials under `/materials`, with independent active state on desktop/mobile. Materials registry shows workbook fields and supports adding/editing/importing. Shared central inventory, disbursements, dashboards and reports retain both types.

Constraints: same active-user read/admin-write RLS and audits; preserve existing UUIDs, transaction snapshots, and depreciation behavior. Add migration after 0004, never modify baseline. No direct live-record changes during implementation. Exercise migration in a disposable database and report runtime migration status precisely.
