# CAMMS Known Issues & Technical Debt

> **Status:** Actively tracked technical observations and verified documentation divergences.  
> **Last Updated:** November 2026

---

## 1. Documentation Divergences (Historical vs. Actual Implementation)

During the deep codebase investigation, several discrepancies between older documentation files and the verified source code were identified:

### 1.1 Supabase Mentions in `README.md` vs. 100% PostgreSQL Implementation
- **Divergence:** Root `README.md` contains badges and setup guides claiming Supabase support.
- **Verified Codebase Reality:** The application has completely migrated to native PostgreSQL. There is **no `@supabase/supabase-js` or `@supabase/ssr` dependency in `package.json`**.
- **Action Required:** Future documentation must clarify that CAMMS runs directly on PostgreSQL 16+ using Drizzle ORM and `pg` pool connections. Supabase connection URLs are only relevant if a developer uses Supabase as a raw managed PostgreSQL host.

### 1.2 User Role Nomenclature (`viewer` vs. `user`)
- **Divergence:** Older design specs and comments refer to three roles: `admin`, `staff`, `viewer`.
- **Verified Codebase Reality:** Migration `0004_rename_viewer_to_user.sql` formally updated all `profiles.role` rows and check constraints:
  ```sql
  CHECK (role IN ('admin', 'user'))
  ```
- **Rule:** The non-admin role is strictly `'user'`, possessing least-privileged read permissions and material requisition rights.

### 1.3 Material Stock Reservation vs. Immediate Deduction
- **Divergence:** Early specifications in `docs/superpowers/specs/2026-11-16-material-disbursement-business-rules.md` proposed a reservation-based model (`reserved_quantity`).
- **Verified Codebase Reality:** Replaced by **Rule 0009** ([0009_immediate_material_stock.sql](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/migrations/0009_immediate_material_stock.sql)). Stock is deducted immediately when a request is submitted (`draft` -> `pending_approval`) and restored only on cancellation or rejection.

---

## 2. Concurrency & High-Stakes Transaction Areas

### 2.1 Last-Admin Protection Serialization
- **Risk:** Two administrators attempting to deactivate or demote each other simultaneously could bypass the `COUNT(*) > 1` check.
- **Implementation:** [features/admin/postgres-policy.ts](file:///D:/Center-Asset-Material-Management-System-main/features/admin/postgres-policy.ts) acquires an explicit PostgreSQL transactional advisory lock before checking the administrator count:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext('camms_admin_protection'));
  ```
- **Constraint:** Any modification to user deactivation or role updates must retain this lock.

### 2.2 Material Reclassification Advisory Lock
- **Risk:** Reclassifying an item from material to asset while a disbursement or stock movement transaction is in flight could cause stock balance inconsistency.
- **Implementation:** [scripts/reclassify-material-to-asset.ts](file:///D:/Center-Asset-Material-Management-System-main/scripts/reclassify-material-to-asset.ts) acquires `pg_advisory_xact_lock(hashtext('camms_material_reclassify'))` and locks all relevant rows before moving rows between `materials` and `items`.

---

## 3. Known Technical Limitations

1. **Integer Quantities Only for Materials:**
   - Both `materials.quantity` and `disbursement_items.requested_qty` are typed as `integer`.
   - Materials that require fractional quantities (e.g., 2.5 liters of chemical, 1.75 meters of fabric) cannot currently be tracked with decimals without unit conversion (e.g. converting to milliliters or centimeters).
2. **Sequential Test Execution on Windows:**
   - Running hundreds of JSDOM React tests in parallel can saturate the V8 memory heap.
   - [scripts/run-tests.ts](file:///D:/Center-Asset-Material-Management-System-main/scripts/run-tests.ts) runs test files sequentially with `--max-old-space-size=2048` and uses Windows `taskkill /f /t` fallback on child process timeouts.
3. **Public Item Route vs Authentication:**
   - `/items/[uuid]` allows unauthenticated scanning of QR asset tags for quick field verification.
   - However, the general `/items` registry page strictly requires an authenticated session.
