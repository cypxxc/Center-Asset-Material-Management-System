# Mixed disbursement cart

User request: preserve the cart across asset/material dropdown changes and allow both types in the same cart.

Design: the catalog receives all items and filters only the visible cards by selected type. The same mounted cart retains selection and quantities. A mixed submission creates separate material_issue and asset_borrow/asset_handover documents in one database transaction, under the existing sorted locks and permission rules. Materials are always issued; borrow/issue selection applies to assets. Clear the cart only after all documents succeed; retain on failure. This covers switching categories during the session, not persistence across reloads.

Steps: add failing mixed/atomic rollback live tests and cart switching UI test; implement transaction-local grouping using the existing endpoint; update catalog filtering and copy; run lifecycle/concurrency/UI tests, TypeScript, lint and build; obtain independent review. No migration or app data changes required.

Completed: one mounted cart retains snapshots and quantities across dropdown changes. Missing items remain visible/removable with an unavailable message. Server validates the complete cart, groups documents by type in one transaction, preserves old `{id}` compatibility and additionally returns `{ids}`. Material documents never receive a borrow due date. A second-document database trigger failure rolls back the first document and its reservation.

Validation: 3 catalog DOM tests passed, including mixed selection, retained quantity and removal of a selected asset missing from refreshed data. PostgreSQL lifecycle/atomic mixed-cart test and real concurrent reservation test passed; fixtures rolled back or cleaned up. TypeScript, lint and production build passed. Independent review found no remaining important issues. Full npm test still stops at the existing React-is-not-defined failures in components/ui/image-crop-dialog.test.tsx. No running app was started.
