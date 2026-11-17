# CAMMS Database Schema Reference

> **Database System:** PostgreSQL 16+  
> **ORM:** Drizzle ORM (`drizzle-orm@0.45.2`)  
> **Schema Definition:** [db/postgres/schema.ts](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/schema.ts)  
> **Migrations Directory:** [db/postgres/migrations/](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/migrations/)

---

## 1. Schema Overview

The database contains two logical schemas:
1. **`public`**: Application business data, inventory registers, disbursements, categories, locations, units, and audit logs.
2. **`private_auth`**: Sensitive authentication data, password hashes, session tokens, and rate-limiting counters.

---

## 2. Table Specifications (`public` Schema)

### 2.1 `public.profiles`
User accounts, roles, and UI preferences.
- **Columns:**
  - `id` (uuid, PK, default `gen_random_uuid()`): Unique user ID.
  - `full_name` (text, not null): User's real name in Thai/English.
  - `email` (text): Unique login email (case-insensitive unique index).
  - `password` (text): Transient column for direct database administration; cleared immediately by BEFORE trigger.
  - `role` (text, not null, default `'user'`): Role name.
  - `is_active` (boolean, not null, default `true`): Account active status.
  - `sidebar_order` (jsonb, default `'[]'`): User's custom navigation menu ordering.
  - `created_at` (timestamptz, not null, default `now()`).
  - `updated_at` (timestamptz, not null, default `now()`).
- **Constraints & Indexes:**
  - `profiles_role_check`: `CHECK (role IN ('admin', 'user'))`
  - `profiles_password_cleared`: `CHECK (password IS NULL)`
  - `profiles_email_unique`: Unique index on `lower(email)`

### 2.2 `public.categories`
Classification categories for items and materials.
- **Columns:**
  - `id` (uuid, PK, default `gen_random_uuid()`).
  - `name` (text, not null): Category name (e.g., "วัสดุสำนักงาน", "ครุภัณฑ์คอมพิวเตอร์").
  - `item_type` (text, not null, default `'asset'`): Target inventory type.
  - `description` (text): Category description.
  - `color` (text, not null, default `'#64748B'`): Hex color code for UI badge.
  - `icon` (text, not null, default `'Tag'`): Lucide icon identifier.
  - `is_active` (boolean, not null, default `true`).
  - `created_at`, `updated_at` (timestamptz).
- **Constraints & Indexes:**
  - `categories_item_type_check`: `CHECK (item_type IN ('asset', 'material'))`
  - `categories_name_type_unique`: Unique index on `(name, item_type)`
  - `categories_id_type_unique`: Unique index on `(id, item_type)` (supports composite foreign keys)

### 2.3 `public.locations`
Storage and placement locations (buildings, rooms, departments).
- **Columns:**
  - `id` (uuid, PK, default `gen_random_uuid()`).
  - `name` (text, not null): Primary location name.
  - `building`, `floor`, `room`, `department`, `description` (text).
  - `is_active` (boolean, not null, default `true`).
  - `created_at`, `updated_at` (timestamptz).

### 2.4 `public.units`
Standard counting units (e.g., เครื่อง, ชิ้น, รีม, กล่อง, ชุด).
- **Columns:**
  - `id` (uuid, PK, default `gen_random_uuid()`).
  - `name` (text, not null, unique).
  - `is_active` (boolean, not null, default `true`).
  - `created_at`, `updated_at` (timestamptz).

### 2.5 `public.inventory_registry`
Global identity authority table preserving UUID uniqueness across assets and materials.
- **Columns:**
  - `id` (uuid, PK): Global inventory item UUID.
  - `item_type` (text, not null): Discriminator (`'asset'` or `'material'`).
- **Constraints:**
  - `inventory_registry_type_check`: `CHECK (item_type IN ('asset', 'material'))`
  - `inventory_registry_id_type_unique`: Unique index on `(id, item_type)`

### 2.6 `public.items` (Durable Assets)
Physical assets and durable equipment requiring individual tracking and depreciation.
- **Columns:**
  - `id` (uuid, PK, default `gen_random_uuid()`).
  - `item_name` (text, not null): Asset name.
  - `item_type` (text, not null, default `'asset'`): Must be `'asset'`.
  - `qualification_status` (text): Threshold status (`'qualified'` or `'below_threshold'`).
  - `category_id` (uuid, FK -> `categories.id`).
  - `location_id` (uuid, FK -> `locations.id`).
  - `unit_id` (uuid, FK -> `units.id`).
  - `quantity` (integer, not null, default `1`).
  - `unit_price` (numeric(12, 2)): Purchase price per unit.
  - `asset_no` (text): Unique government asset code (รหัสครุภัณฑ์).
  - `serial_no` (text): Manufacturer serial number.
  - `brand`, `model` (text): Brand and model.
  - `responsible_person` (text): Current custodian or assigned staff member.
  - `status` (text, not null, default `'active'`): Operational condition.
  - `note`, `image_url` (text).
  - `is_central` (boolean, not null, default `false`): Central pool item flag.
  - `budget_source`, `gfmis_number` (text): Thai government fiscal accounting fields.
  - `acquired_date` (date): Acquisition date.
  - `created_by`, `updated_by`, `deleted_by` (uuid, FK -> `profiles.id`, `ON DELETE SET NULL`).
  - `deleted_at` (timestamptz): Soft-delete timestamp.
  - `depreciation_enabled` (boolean, not null, default `false`).
  - `depreciation_method` (text, default `'straight_line'`).
  - `depreciation_cost` (numeric(12, 2)): Original cost basis for depreciation.
  - `depreciation_useful_life_years` (integer): Useful life (typically 5 to 20 years).
  - `depreciation_start_basis` (text): `'acquired'`, `'available'`, or `'manual'`.
  - `depreciation_start_date` (date): Date depreciation begins.
  - `depreciation_residual_value` (numeric(12, 2), not null, default `1.00`): Scrap value (strictly 1 THB).
  - `register_sequence`, `asset_prefix` (text): Government ledger sequencing.
  - `register_accumulated_depreciation` (numeric(14, 2)): Historical accumulated depreciation.
  - `register_book_value` (numeric(14, 2)): Net book value as of register date.
  - `register_as_of` (date): Register accounting baseline date.
  - `created_at`, `updated_at` (timestamptz).
- **Key Constraints:**
  - `items_type_check`: `CHECK (item_type = 'asset')`
  - `items_status_check`: `CHECK (status IN ('active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed'))`
  - `items_category_type_fk`: Composite foreign key `(category_id, item_type)` references `categories(id, item_type)`
  - `items_depreciation_check`: Validates that enabled depreciation satisfies straight-line rules and residual value = 1.
  - `items_asset_no_unique`: Partial unique index on `asset_no` where `deleted_at IS NULL AND asset_no IS NOT NULL`.

### 2.7 `public.materials` (Consumable Materials)
Consumable goods and office supplies with Thai government inventory ledger fields.
- **Columns:**
  - Common inventory columns matching `items`: `id`, `item_name`, `item_type`, `category_id`, `location_id`, `unit_id`, `quantity`, `unit_price`, `status`, `note`, `image_url`, `created_by`, `updated_by`, `deleted_by`, `deleted_at`, `created_at`, `updated_at`.
  - `metadata_version` (bigint, not null, default `1`): Optimistic concurrency lock.
  - `stock_version` (bigint, not null, default `1`): Stock deduction concurrency lock.
  - `specification` (text): Technical specifications (คุณลักษณะเฉพาะ).
  - `commodity_code` (text): Government commodity code (รหัสพัสดุ).
  - `minimum_quantity`, `maximum_quantity` (integer): Reorder point thresholds.
  - `fiscal_year` (integer): Thai fiscal year (e.g. 2570).
  - `balance_as_of` (date): Date of official balance calculation.
  - `opening_quantity` (int), `opening_amount` (numeric(14, 2)): Beginning inventory balance.
  - `received_quantity` (int), `received_amount` (numeric(14, 2)): Year-to-date receipts.
  - `issued_quantity` (int), `issued_amount` (numeric(14, 2)): Year-to-date disbursements.
  - `balance_amount` (numeric(14, 2)): Remaining inventory value.
- **Key Constraints:**
  - `materials_type_check`: `CHECK (item_type = 'material')`
  - `materials_depreciation_check`: `CHECK (NOT depreciation_enabled)` (materials cannot depreciate)
  - `materials_category_type_fk`: Composite FK `(category_id, item_type)` references `categories(id, item_type)`
  - `materials_ledger_check`: All quantities and monetary amounts must be >= 0.

### 2.8 View: `public.inventory_items`
```sql
CREATE VIEW public.inventory_items WITH (security_invoker=true) AS
SELECT id, item_name, item_type, qualification_status, category_id, location_id, unit_id,
       quantity, unit_price, asset_no, serial_no, brand, model, responsible_person,
       status, note, image_url, is_central, budget_source, gfmis_number, acquired_date,
       created_by, updated_by, deleted_by, deleted_at, depreciation_enabled,
       depreciation_method, depreciation_cost, depreciation_useful_life_years,
       depreciation_start_basis, depreciation_start_date, depreciation_residual_value,
       created_at, updated_at, register_sequence, asset_prefix,
       register_accumulated_depreciation, register_book_value, register_as_of
FROM public.items
UNION ALL
SELECT id, item_name, item_type, qualification_status, category_id, location_id, unit_id,
       quantity, unit_price, asset_no, serial_no, brand, model, responsible_person,
       status, note, image_url, is_central, budget_source, gfmis_number, acquired_date,
       created_by, updated_by, deleted_by, deleted_at, depreciation_enabled,
       depreciation_method, depreciation_cost, depreciation_useful_life_years,
       depreciation_start_basis, depreciation_start_date, depreciation_residual_value,
       created_at, updated_at, NULL AS register_sequence, NULL AS asset_prefix,
       NULL AS register_accumulated_depreciation, NULL AS register_book_value, NULL AS register_as_of
FROM public.materials;
```

### 2.9 `public.disbursements` & `public.disbursement_items`
Requisition documents and line items for materials and assets.
- **`disbursements` Columns:**
  - `id` (uuid, PK).
  - `document_no` (text, unique): Formatted document code (e.g., `DIS-2570-0001`).
  - `fiscal_year` (integer): Thai fiscal year.
  - `transaction_type` (text, not null): `'material_issue'`, `'asset_handover'`, or `'asset_borrow'`.
  - `recipient_name`, `department_name`, `purpose` (text, not null).
  - `status` (text, not null, default `'draft'`):
    - `'draft'` -> `'pending_approval'` -> `'confirmed'` / `'active_borrow'` -> `'partially_returned'` -> `'returned'` / `'reversed'` / `'cancelled'` / `'rejected'`.
  - `due_date` (date): Return due date (mandatory for `'asset_borrow'`).
  - `submitted_at`, `handed_over_at`, `handed_over_by` (timestamptz/uuid).
  - `confirmed_at`, `confirmed_by`, `reversal_reason`, `reversed_at`, `reversed_by` (timestamptz/uuid).
  - `created_by`, `created_at`, `updated_at`.
- **`disbursement_items` Columns:**
  - `id` (uuid, PK).
  - `disbursement_id` (uuid, not null, FK -> `disbursements.id`, `ON DELETE RESTRICT`).
  - `item_id` (uuid, not null, FK -> `inventory_registry.id`, `ON DELETE RESTRICT`).
  - `requested_qty` (int, not null), `issued_qty` (int, default 0), `returned_qty` (int, default 0).
  - Immutable snapshots: `item_name_snapshot`, `asset_no_snapshot`, `serial_no_snapshot`, `unit_name_snapshot`, `unit_price_snapshot`, `category_name_snapshot`, `location_name_snapshot`.
  - `status` (text, default `'pending'`): `'pending'`, `'issued'`, `'partially_returned'`, `'returned'`, `'reversed'`.

### 2.10 `public.stock_movements` & `public.material_stock_documents`
Immutable double-entry stock movement ledger for consumable materials.
- **`movement_type`:** `'issue'`, `'reversal'`, `'adjust_audit'`, `'receipt'`, `'material_return'`.
- Enforces `balance_after >= 0` check constraint.

### 2.11 `public.asset_custody_logs`
Custody tracking for durable equipment loan and assignment history.
- **`action`:** `'handover'`, `'borrow'`, `'return'`, `'reversal'`.
- **`item_condition`:** `'normal'`, `'damaged'`, `'lost'`.

### 2.12 `public.audit_logs`
Immutable audit trail tracking mutations across the system.
- **Columns:** `id`, `user_id` (FK -> `profiles.id`), `action`, `target_table`, `target_id`, `old_data` (jsonb), `new_data` (jsonb), `created_at`.

---

## 3. Authentication Schema (`private_auth`)

- **`private_auth.credentials`:**
  - `user_id` (uuid, PK, FK -> `profiles.id`, `ON DELETE CASCADE`).
  - `password_hash` (text, not null): Bcrypt hashed password.
- **`private_auth.sessions`:**
  - `token_hash` (text, PK): SHA-256 hash of the 64-char random session cookie.
  - `user_id` (uuid, not null, FK -> `profiles.id`, `ON DELETE CASCADE`).
  - `expires_at` (timestamptz, not null): Default 8 hours from issue.
  - `created_at` (timestamptz, not null, default `now()`).
- **`private_auth.login_attempts` & `private_auth.rate_limits`:**
  - Sliding window rate limiting tables keyed by IP/identifier.

---

## 4. Migration History & Journal

| Migration File | Key Purpose |
| :--- | :--- |
| `0000_final_schema.sql` | Baseline schema: profiles, items, disbursements, audit logs, private_auth. |
| `0001_navicat_password_input.sql` | Added `profiles.password` column and BEFORE trigger for external DB tools. |
| `0002_password_insert_conflict_guard.sql` | Concurrency guard on password creation. |
| `0003_serialize_all_profile_inserts.sql` | Serialized profile creation to prevent duplicate email race conditions. |
| `0004_rename_viewer_to_user.sql` | Renamed role `'viewer'` to `'user'` across database checks and defaults. |
| `0005_separate_materials.sql` | Created `public.materials` and `public.inventory_registry`; created `public.inventory_items` union view. |
| `0006_asset_register_fields.sql` | Added `register_sequence`, `asset_prefix`, `register_accumulated_depreciation`, `register_book_value` to `items`. |
| `0007_material_quantity_reservations.sql` | Initial material reservation triggers. |
| `0008_material_drafts_without_reservation.sql` | Clarified drafts do not hold stock. |
| `0009_immediate_material_stock.sql` | **Crucial Business Rule:** Replaced reservation with immediate physical stock deduction on requisition submission. |
| `0010_material_stock_restore_guard.sql` | Safeguard restoring stock on request cancellation or rejection. |
| `0011_disbursement_standard_remediation.sql` | Aligned disbursement state machine, sequences, and custody logs. |
| `0012_material_borrow.sql` | Supported material borrowing and return tracking in disbursement engine. |
| `0013_category_types.sql` | Added `categories.item_type` (`'asset'` or `'material'`) and composite foreign key enforcement. |
