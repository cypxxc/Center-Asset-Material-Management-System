# CAMMS — Laravel Monolith & Inertia.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate CAMMS from Next.js 16 to a high-reliability, enterprise-grade Laravel 11 + Inertia.js (React 19) + PostgreSQL 16 application supporting both Durable Assets (ครุภัณฑ์) and Consumable Materials (วัสดุสิ้นเปลือง), complete with automated audit logs, background queues, Thai government fiscal year depreciation, and Browsershot PDF/QR generation.

**Architecture:** Monolithic architecture with Laravel 11 handling routing, business logic, Eloquent ORM, queues, and security policies, while Inertia.js seamlessly serves existing React 19 frontend components with shared Tailwind CSS, Lucide Icons, and Capriola/Sarabun fonts without rewrite.

**Tech Stack:** 
- Backend: PHP 8.3+, Laravel 11.x, PostgreSQL 16 (ICU `th-TH-x-icu`), Redis/Database Queue
- Frontend: Inertia.js React, React 19, TypeScript, Tailwind CSS v4, Lucide React, Ziggy
- Packages: `spatie/laravel-activitylog`, `spatie/browsershot`, `spatie/laravel-data`, `spatie/laravel-typescript-transformer`, `maatwebsite/excel`, `simplesoftwareio/simple-qrcode`, `tightenco/ziggy`

**Spec:** `docs/superpowers/specs/2026-10-14-laravel-migration-design.md`

## Global Constraints

- Monetary precision MUST strictly use `DECIMAL(15, 2)` and `bcmath` in PHP; `FLOAT` and `DOUBLE` are forbidden.
- Deleted assets and materials MUST use `SoftDeletes`; physical `forceDelete` is disabled across all policies.
- Partial unique indexes (`WHERE deleted_at IS NULL`) MUST be used for `assets.asset_code` and `materials.sku`.
- Admin self-protection MUST be concurrency-safe using `lockForUpdate()` within transactions ensuring $\ge 1$ active Admin remains.
- Audit tables (`activity_log`, `depreciation_records`, `stock_transactions`) MUST be protected by DB-level append-only triggers.
- Minimum Net Book Value floor of `1.00 THB` is mandatory for fully depreciated active assets.
- Thai fiscal year window is fixed: October 1st to September 30th.

## Review Focus

1. **Mid-Year Acquisition Pro-Rata Depreciation:** Asset acquired mid-fiscal-year computes exact pro-rata depreciation based on actual days held up to Sep 30.
2. **Concurrent Material Stock Deductions:** Concurrent dispatch requests deducting quantity beyond available stock throws `InsufficientStockException` rather than negative balance.
3. **Duplicate Physical Audit Check-in:** Scanning the same asset within the same open `AuditSession` rejects duplicate creation while permitting status/remark update.
4. **Admin Account Demotion Race Condition:** Simultaneous demotion/deletion of the last two active Admins leaves exactly one Admin active.
5. **Thai Vowel & Tone Mark PDF Rendering:** Official forms rendered via Browsershot display correct tone-mark positioning without `สระลอย`.

---

### Task 1: Scaffolding, Composer Dependencies & Docker Setup

**Files:**
- Create: `composer.json` (or Laravel app root `backend/composer.json` or root depending on structure)
- Create: `docker/Dockerfile`
- Create: `docker/docker-compose.yml`
- Test: `tests/Feature/HealthCheckTest.php`

**Interfaces:**
- Consumes: PostgreSQL 16 container, Chromium binary, Sarabun & Capriola font files
- Produces: Base running Laravel 11 environment with Redis/DB queue and Headless Chromium

- [ ] **Step 1: Write the failing health check test**
```php
public function test_system_health_and_database_connection(): void {
    $response = $this->get('/api/health/status');
    $response->assertStatus(200)->assertJson(['status' => 'healthy', 'database' => 'connected']);
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=HealthCheckTest`
Expected: FAIL

- [ ] **Step 3: Setup Docker container with PHP 8.3, Chromium, and Thai Fonts**
Configure `docker/Dockerfile` with `chromium`, `libnss3`, and copy `Sarabun-*.ttf`, `Capriola-*.ttf` to `/usr/share/fonts/truetype/camms/` followed by `fc-cache -f -v`. Install required composer packages.

- [ ] **Step 4: Implement health check endpoint in `routes/api.php`**
Implement `/api/health/status` verifying DB connectivity and returning JSON.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=HealthCheckTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "chore: setup Laravel 11 scaffolding, Docker with Chromium, and health check"
```

---

### Task 2: Database Migrations, Indexes & Immutability Triggers

**Files:**
- Create: `database/migrations/2026_10_14_000001_create_camms_tables.php`
- Create: `database/migrations/2026_10_14_000002_create_immutability_triggers.php`
- Test: `tests/Feature/DatabaseImmutabilityTest.php`

**Interfaces:**
- Consumes: PostgreSQL 16
- Produces: Complete schema: `users`, `categories`, `locations`, `units`, `assets`, `materials`, `stock_transactions`, `depreciation_records`, `audit_sessions`, `audit_checks`

- [ ] **Step 1: Write failing test for partial unique indexes and immutability triggers**
```php
public function test_cannot_update_or_delete_immutability_records(): void {
    // Assert DB trigger throws exception on UPDATE / DELETE of depreciation_records
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=DatabaseImmutabilityTest`
Expected: FAIL

- [ ] **Step 3: Author migrations with partial unique indexes and DECIMAL(15,2)**
Add partial indexes `WHERE deleted_at IS NULL` for `assets.asset_code` and `materials.sku`. Composite unique `UNIQUE(audit_session_id, asset_id)` on `audit_checks` and `UNIQUE(asset_id, fiscal_year)` on `depreciation_records`.

- [ ] **Step 4: Add PostgreSQL trigger function blocking UPDATE/DELETE**
Create function `block_immutable_mutation()` and bind `BEFORE UPDATE OR DELETE` triggers to `activity_log`, `depreciation_records`, and `stock_transactions`.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=DatabaseImmutabilityTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(db): add migrations with partial unique indexes and immutability triggers"
```

---

### Task 3: Eloquent Models, Relationships & Spatie Laravel Data DTOs

**Files:**
- Create: `app/Models/User.php`
- Create: `app/Models/Asset.php`
- Create: `app/Models/Material.php`
- Create: `app/Models/StockTransaction.php`
- Create: `app/Models/AuditSession.php`
- Create: `app/Models/AuditCheck.php`
- Create: `app/Models/DepreciationRecord.php`
- Create: `app/Data/AssetData.php`
- Create: `app/Data/MaterialData.php`
- Test: `tests/Unit/ModelRelationshipTest.php`

**Interfaces:**
- Consumes: Tables created in Task 2
- Produces: Strongly-typed Eloquent models and auto-generated TypeScript definitions (`resources/js/types/generated.d.ts`)

- [ ] **Step 1: Write failing unit test for Model relationships and SoftDeletes**
```php
public function test_asset_and_material_relationships_and_soft_deletes(): void {
    // Assert asset belongsTo Category, Location, Unit; soft delete sets deleted_at
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=ModelRelationshipTest`
Expected: FAIL

- [ ] **Step 3: Implement Eloquent Models with Spatie ActivityLog & SoftDeletes**
Define casts (`cost` to `decimal:2`), relationships, `LogsActivity` configuration. Configure `spatie/laravel-typescript-transformer`.

- [ ] **Step 4: Run test to verify it passes & generate TypeScript definitions**
Run: `php artisan test --filter=ModelRelationshipTest && php artisan typescript:transform`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(models): implement Eloquent models, Spatie Data DTOs, and TypeScript transform"
```

---

### Task 4: RBAC Policies & Concurrency-Safe Admin Protection

**Files:**
- Create: `app/Policies/AssetPolicy.php`
- Create: `app/Policies/MaterialPolicy.php`
- Create: `app/Policies/UserPolicy.php`
- Create: `app/Services/UserService.php`
- Test: `tests/Feature/RbacAndAdminProtectionTest.php`

**Interfaces:**
- Consumes: `User`, `Asset`, `Material` models
- Produces: RBAC authorization logic matching CAMMS hard rules

- [ ] **Step 1: Write failing tests for RBAC matrix and Admin self-protection**
```php
public function test_staff_cannot_delete_items(): void { ... }
public function test_admin_cannot_demote_themselves_if_last_admin(): void { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=RbacAndAdminProtectionTest`
Expected: FAIL

- [ ] **Step 3: Implement Policies and UserService with `lockForUpdate()`**
In `UserService`, wrap user deactivation/demotion/deletion inside `DB::transaction()` with `User::where('role', 'admin')->where('is_active', true)->lockForUpdate()->count()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `php artisan test --filter=RbacAndAdminProtectionTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(auth): implement RBAC policies and concurrency-safe Admin protection"
```

---

### Task 5: Depreciation Calculation Service & Stock Management Service

**Files:**
- Create: `app/Services/DepreciationCalculatorService.php`
- Create: `app/Services/StockManagementService.php`
- Test: `tests/Unit/DepreciationCalculatorTest.php`
- Test: `tests/Feature/StockConcurrencyTest.php`

**Interfaces:**
- Consumes: `Asset`, `Material`, `StockTransaction`
- Produces: Accurate financial depreciation (Pro-rata, 1-Baht floor) and atomic inventory movements

- [ ] **Step 1: Write failing tests for pro-rata depreciation, 1-baht floor, and stock locking**
```php
public function test_pro_rata_mid_year_depreciation(): void { ... }
public function test_fully_depreciated_asset_floors_at_one_baht(): void { ... }
public function test_concurrent_stock_reduction_prevents_negative(): void { ... }
```

- [ ] **Step 2: Run tests to verify they fail**
Run: `php artisan test --filter=DepreciationCalculatorTest`
Expected: FAIL

- [ ] **Step 3: Implement DepreciationCalculatorService using `bcmath`**
Implement Thai fiscal year boundaries (Oct 1 – Sep 30), pro-rata days calculation, and 1.00 THB floor.

- [ ] **Step 4: Implement StockManagementService with `lockForUpdate()`**
Implement atomic stock transactions (`IN`, `OUT`, `ADJUST`) within a `DB::transaction()` preventing negative stock.

- [ ] **Step 5: Run tests to verify they pass**
Run: `php artisan test --filter=DepreciationCalculatorTest && php artisan test --filter=StockConcurrencyTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(services): implement depreciation calculator with 1-baht floor and atomic stock service"
```

---

### Task 6: Audit Context Middleware & Scheduled Fiscal Year Job

**Files:**
- Create: `app/Http/Middleware/CaptureAuditContextMiddleware.php`
- Create: `app/Jobs/CalculateFiscalYearDepreciationJob.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/FiscalYearJobTest.php`

**Interfaces:**
- Consumes: `DepreciationCalculatorService`, `activity_log`
- Produces: Automated yearly depreciation calculations on Sep 30 and IP/User-Agent attribution on all audit entries

- [ ] **Step 1: Write failing test for Fiscal Year job idempotency and middleware IP capture**
```php
public function test_fiscal_year_job_computes_idempotently_without_duplicates(): void { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=FiscalYearJobTest`
Expected: FAIL

- [ ] **Step 3: Implement CaptureAuditContextMiddleware**
Inject `ip_address` and `user_agent` into Spatie ActivityLog properties.

- [ ] **Step 4: Implement CalculateFiscalYearDepreciationJob & register in `routes/console.php`**
Iterate active assets chunked, compute fiscal year depreciation, and persist `depreciation_records` idempotently using `upsert`.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=FiscalYearJobTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(jobs): implement audit context middleware and scheduled fiscal year job"
```

---

### Task 7: Server-Side PDF (Browsershot) & QR Code Tag Generator

**Files:**
- Create: `app/Services/PdfReportService.php`
- Create: `app/Services/QrTagGeneratorService.php`
- Create: `resources/views/reports/pordor1.blade.php`
- Create: `resources/views/labels/qr-thermal.blade.php`
- Create: `resources/views/labels/qr-a4.blade.php`
- Test: `tests/Feature/PdfAndQrGenerationTest.php`

**Interfaces:**
- Consumes: Headless Chromium container, Sarabun font, `Asset` records
- Produces: Official Thai government PDFs (พด.1/พด.2) and A4 / Thermal printable QR labels

- [ ] **Step 1: Write failing test for PDF generation and QR SVG generation**
```php
public function test_can_generate_pdf_with_sarabun_font_and_qr_tags(): void { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=PdfAndQrGenerationTest`
Expected: FAIL

- [ ] **Step 3: Implement PdfReportService using Browsershot**
Configure HTML templates with embedded Sarabun typography, custom margins, and page breaks.

- [ ] **Step 4: Implement QrTagGeneratorService using `simplesoftwareio/simple-qrcode`**
Support signed check-in URLs, outputting SVG/PNG for Thermal roll (50x30mm) and A4 grid sheets.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=PdfAndQrGenerationTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(reports): implement Browsershot PDF reporting and QR label generator"
```

---

### Task 8: Inertia.js React 19 Frontend Bridge & Ziggy Routes

**Files:**
- Create: `app/Http/Middleware/HandleInertiaRequests.php`
- Create: `resources/js/app.tsx`
- Create: `resources/js/Pages/Assets/Index.tsx`
- Create: `resources/js/Pages/Materials/Index.tsx`
- Create: `resources/js/Pages/Audit/Scan.tsx`
- Modify: `routes/web.php`
- Test: `tests/Feature/InertiaPageRenderTest.php`

**Interfaces:**
- Consumes: Existing React components, Lucide icons, Ziggy route helper
- Produces: Functional Inertia.js React 19 views replacing Next.js App Router

- [ ] **Step 1: Write failing test for Inertia page renders and shared auth props**
```php
public function test_inertia_asset_index_renders_with_shared_user_and_permissions(): void { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=InertiaPageRenderTest`
Expected: FAIL

- [ ] **Step 3: Configure HandleInertiaRequests middleware**
Share `auth.user`, `permissions`, and `flash` messages globally. Setup Ziggy route generator.

- [ ] **Step 4: Wire React components with `@inertiajs/react` (`Link`, `useForm`)**
Port Next.js pages to Inertia views. Integrate mobile camera QR scanner (`html5-qrcode`) on `Audit/Scan.tsx`.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=InertiaPageRenderTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(frontend): integrate Inertia.js with React 19 and Ziggy routes"
```

---

### Task 9: Legacy ETL Migration & Verification Commands

**Files:**
- Create: `app/Console/Commands/MigrateLegacyDataCommand.php`
- Create: `app/Console/Commands/VerifyMigrationCommand.php`
- Test: `tests/Feature/LegacyMigrationCommandTest.php`

**Interfaces:**
- Consumes: Legacy PostgreSQL connection (`pgsql_legacy`), Supabase storage files
- Produces: Safe, idempotent data migration and mathematical integrity verification

- [ ] **Step 1: Write failing test for ETL idempotency and checksum verification**
```php
public function test_etl_migrates_records_and_preserves_bcrypt_hashes(): void { ... }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `php artisan test --filter=LegacyMigrationCommandTest`
Expected: FAIL

- [ ] **Step 3: Implement `php artisan camms:migrate-legacy-data`**
Topological transfer within transaction: `units` -> `categories` -> `locations` -> `users` (preserving `$2a$`/`$2b$` bcrypt hashes) -> `assets` & `materials` -> `stock_transactions`, `depreciation_records`, `audit_sessions`, `audit_checks`.

- [ ] **Step 4: Implement `php artisan camms:verify-migration`**
Validate row counts, total asset acquisition cost, and stock quantities matching between legacy and target databases.

- [ ] **Step 5: Run test to verify it passes**
Run: `php artisan test --filter=LegacyMigrationCommandTest`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -m "feat(etl): implement legacy data migration and verification commands"
```
