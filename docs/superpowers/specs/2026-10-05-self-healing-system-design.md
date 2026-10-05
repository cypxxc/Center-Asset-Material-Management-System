# CAMMS Self-Healing & System Reliability Subsystem — Architectural Design Spec

**Date:** 2026-10-05  
**Status:** Proposed design ready for review  
**Scope:** Architectural Subsystem (Diagnostics, Self-Healing Engine, MCP Tools, Scheduled Health Jobs, and Admin Dashboard Interface)

---

## 1. Objective

Provide CAMMS (Center Asset & Material Management System) with an autonomous, resilient self-healing subsystem. The system will continuously monitor data consistency, proactively detect anomalies, automatically correct safe operational issues (such as cache desynchronization, orphaned references, and database statistical drift), log all remediation events to an immutable audit trail, and expose programmatic tools via MCP and REST APIs for automated background scheduling.

---

## 2. Core Architectural Principles

1. **Safety First (Do No Harm):**
   - The engine automatically resolves only **safe, deterministic, and non-destructive** issues (e.g., refreshing stale caches, safely quarantining orphaned records into a dedicated review location/category, refreshing PostgreSQL table statistics).
   - Ambiguous or potentially destructive issues (e.g., conflicting duplicate serial numbers or conflicting user entries) are flagged as **`NEEDS_HUMAN_REVIEW`** with diagnostic recommendations, never silently deleted or overwritten.

2. **Full Audit Transparency:**
   - Every automatic remediation action is recorded in `audit_logs` with actor `SYSTEM_SELF_HEAL` and structured metadata capturing what was found, what action was applied, and which IDs were affected.

3. **Dual Backend Compatibility:**
   - Must operate seamlessly under both `DATA_BACKEND=supabase` and `DATA_BACKEND=postgres` (Drizzle ORM).

4. **Multiple Trigger Modalities:**
   - **Automated Agent (MCP):** Accessible via MCP Tools for AI agents running periodic inspections.
   - **Background Job (Cron/CLI):** Executable as a scheduled CLI command or cron task.
   - **On-Demand Admin UI:** Viewable and triggerable by system administrators through the Web UI.

---

## 3. Subsystem Architecture & Components

```
┌────────────────────────────────────────────────────────┐
│                   Trigger Boundaries                   │
│   ┌────────────────┐   ┌──────────────┐   ┌─────────┐  │
│   │ MCP Tool Call  │   │ Nightly Cron │   │ Admin UI│  │
│   └───────┬────────┘   └──────┬───────┘   └────┬────┘  │
└───────────┼───────────────────┼────────────────┼───────┘
            ▼                   ▼                ▼
┌────────────────────────────────────────────────────────┐
│             Self-Healing Service Boundary              │
│                                                        │
│  1. Diagnostic Scanner (scanner.ts)                    │
│     ├── Data Integrity Rules (Duplicates, Nulls)       │
│     ├── Relational Orphan Rules (Category, Location)   │
│     ├── Cache Freshness Rules (Tag/Count Discrepancy)  │
│     └── DB Health Rules (Dead tuples, Missing stats)   │
│                                                        │
│  2. Remediation Engine (healer.ts)                     │
│     ├── Cache Self-Heal (revalidateTag / revalidatePath)│
│     ├── Orphan Quarantine (Reassign to safe fallback)  │
│     └── DB Optimize (Run ANALYZE / vacuum hints)       │
│                                                        │
│  3. Audit Logger (audit.ts)                            │
│     └── Persist remediation events to audit_logs       │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Persistence Layer                    │
│        (Supabase Service Client / Drizzle Postgres)    │
└────────────────────────────────────────────────────────┘
```

### Component Details

### 3.1. Diagnostic Scanner (`lib/self-healing/scanner.ts`)
Executes an array of health check rules and returns a structured `DiagnosticReport`:

* **`Rule 1: Cache Freshness Check`**
  - Compares the item counts cached in Next.js cache tags against the live count in the database.
  - Severity: `LOW`. Auto-healable: `YES`.
* **`Rule 2: Orphaned Relationship Check`**
  - Scans `items` for foreign keys (`category_id`, `location_id`, `unit_id`) that no longer exist in their respective lookup tables.
  - Severity: `MEDIUM`. Auto-healable: `YES` (via Quarantine).
* **`Rule 3: Duplicate Identifier Check`**
  - Scans for identical non-empty `asset_no` or `serial_no` assigned to distinct items.
  - Severity: `HIGH`. Auto-healable: `NO` (Flagged for human review).
* **`Rule 4: Inconsistent Stock / Valuation Check`**
  - Scans for negative quantities (`quantity < 0`) or missing unit prices on active materials.
  - Severity: `MEDIUM`. Auto-healable: `NO` (Flagged for human review).
* **`Rule 5: Database Health / Statistics Drift`**
  - On PostgreSQL, queries `pg_stat_user_tables` to identify tables with high modification counts since last analyze.
  - Severity: `LOW`. Auto-healable: `YES` (via `ANALYZE`).

### 3.2. Remediation Engine (`lib/self-healing/healer.ts`)
Applies deterministic fixes based on diagnostic findings:

* **Action `revalidate_cache`:**
  - Invokes `revalidateTag('items')`, `revalidateTag('sidebar-counts')`, and revalidates dashboard paths.
* **Action `quarantine_orphans`:**
  - Creates or retrieves a system-managed quarantine entity (e.g. Category `[รอตรวจสอบ - Auto Quarantined]` or Location `[จุดพักรอตรวจสอบ]`).
  - Updates affected orphan items to reference this entity, appending an explanatory tag in `note` without destroying existing attributes.
* **Action `optimize_database`:**
  - In PostgreSQL mode, runs parameterized `ANALYZE` commands on `items`, `categories`, and `locations` to refresh planner statistics.

### 3.3. Audit & Reporting (`lib/self-healing/audit.ts`)
* Writes a record to `audit_logs` table:
  - `action`: `SYSTEM_SELF_HEAL`
  - `table_name`: targeted table (e.g. `items`, `system`)
  - `record_id`: affected record ID or `00000000-0000-0000-0000-000000000000` for system-wide actions.
  - `details`: JSON payload containing diagnostic code, prior state, new state, and trigger source (`mcp`, `cron`, or `admin_ui`).

---

## 4. Interfaces & Integration

### 4.1. MCP Server Integration ([`scripts/mcp-server.ts`](file:///D:/Chayaphon/Code/Center-Asset-Material-Management-System-main/scripts/mcp-server.ts))
Expose two new tools:
1. **`diagnose_system_health`**
   - **Parameters:** `{ include_db_stats?: boolean }`
   - **Response:** Summary health score (0-100%), list of detected issues categorized by severity (`LOW`, `MEDIUM`, `HIGH`), and auto-heal eligibility.
2. **`heal_system_issues`**
   - **Parameters:** `{ issue_codes?: string[], dry_run?: boolean }`
   - **Response:** Execution log detailing actions taken, number of items repaired, and audit IDs created.

### 4.2. CLI Background Runner ([`scripts/self-healing-job.ts`](file:///D:/Chayaphon/Code/Center-Asset-Material-Management-System-main/scripts/self-healing-job.ts))
* Designed to run unattended via Windows Task Scheduler or CI/Cron:
  ```bash
  npm run health:heal
  # or dry-run inspection:
  npm run health:diagnose
  ```
* Returns exit code `0` on healthy/successfully healed, and `1` if unresolvable high-severity issues require human attention.

### 4.3. Admin API Route ([`app/api/admin/self-healing/route.ts`](file:///D:/Chayaphon/Code/Center-Asset-Material-Management-System-main/app/api/admin/self-healing/route.ts))
* `GET /api/admin/self-healing`: Returns the current system health report (Admin session required).
* `POST /api/admin/self-healing`: Triggers safe remediation actions with CSRF/session protection.

### 4.4. Admin UI Widget
* Embedded in the Admin Settings / System Status page:
  - Visual status pill: 🟢 **ระบบสมบูรณ์ (100%)** / 🟡 **ตรวจพบปัญหาที่ซ่อมแซมได้** / 🔴 **มีข้อมูลรอตรวจสอบ**
  - "ตรวจสุขภาพและแก้ไขทันที" (Run Diagnostics & Auto-Heal) button with live progress indicator.
  - Recent Self-Healing History table from `audit_logs`.

---

## 5. Security & Isolation Considerations

1. **Privilege Boundary:**
   - Self-healing actions modify data and thus require elevated permissions (Service Role in Supabase mode, Admin connection pool in PostgreSQL mode).
   - API endpoints enforce strict `admin` role checks. Unauthorized or anonymous calls are rejected with `403 Forbidden`.
2. **Rate Limiting & Loop Prevention:**
   - The healer maintains an execution cooldown (maximum 1 auto-heal run per 5 minutes per action type) to prevent runaway repair loops.
3. **Data Loss Prevention:**
   - The engine **never executes `DELETE` operations**. Orphaned items are relocated to quarantine, never dropped.

---

## 6. Testing & Verification Plan

1. **Unit Tests:**
   - [`tests/self-healing/scanner.test.ts`](file:///D:/Chayaphon/Code/Center-Asset-Material-Management-System-main/tests/self-healing/scanner.test.ts): Verify detection of mocked duplicates, orphans, and cache discrepancies.
   - [`tests/self-healing/healer.test.ts`](file:///D:/Chayaphon/Code/Center-Asset-Material-Management-System-main/tests/self-healing/healer.test.ts): Verify safe quarantine assignment and cache revalidation calls.
2. **Integration Tests:**
   - Verify `scripts/mcp-server.ts` handles `diagnose_system_health` and `heal_system_issues` correctly over JSON-RPC stdio.
   - Verify audit entries are properly written to `audit_logs`.
3. **End-to-End Simulation:**
   - Seed a test orphan item into a test database -> run `heal_system_issues` -> verify item is safely quarantined and audit log is created.
