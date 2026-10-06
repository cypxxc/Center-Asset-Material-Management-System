# CAMMS Self-Healing & System Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate an autonomous diagnostic and self-healing subsystem for CAMMS that detects data anomalies, automatically resolves safe operational issues (stale caches, orphan references, database statistical drift), records immutable audit entries, and exposes interfaces via MCP, CLI background jobs, and Admin REST API.

**Architecture:** A modular service layer under `lib/self-healing/` separated into Diagnostic Scanner (`scanner.ts`), Remediation Engine (`healer.ts`), and Audit Logger (`audit.ts`). Exposed to consumers via MCP stdio tools in `scripts/mcp-server.ts`, an unattended CLI runner in `scripts/self-healing-job.ts`, and a protected Next.js route in `app/api/admin/self-healing/route.ts`.

**Tech Stack:** TypeScript, Next.js 16 (App Router), Node.js Stdio JSON-RPC 2.0 (MCP), Supabase JS / Drizzle ORM, Node.js Test Runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-10-05-self-healing-system-design.md`

## Global Constraints

- Never execute destructive `DELETE` operations during self-healing; orphaned entities must be quarantined, not deleted.
- Non-deterministic issues (duplicate serial numbers, inventory discrepancies) must be marked `NEEDS_HUMAN_REVIEW` and never auto-mutated.
- All auto-remediation actions must be logged to `audit_logs` with `action: 'SYSTEM_SELF_HEAL'`.
- Must support both `DATA_BACKEND=supabase` and `DATA_BACKEND=postgres`.
- Node.js test runner (`tsx --test` or `scripts/run-tests.ts`) must pass for all added tests.

## Review Focus

1. **Destructive Mutation Prevention:** Ensure `healer.ts` never deletes rows or overwrites valid asset numbers.
2. **Infinite Healing Loop:** Ensure cooldown/rate-limiting prevents repeated re-runs if an issue cannot be auto-cleared.
3. **Privilege Boundary:** Ensure unauthorized users cannot trigger `POST /api/admin/self-healing`.
4. **RLS & Key Isolation:** Ensure MCP health tools only mutate data when explicit write permissions/service role keys are present.
5. **Cache Serialization:** Ensure `revalidateTag` and `revalidatePath` handle Next.js cache boundaries gracefully in background processes.

---

### Task 1: Diagnostic Types & Scanner Core

**Files:**
- Create: `lib/self-healing/types.ts`
- Create: `lib/self-healing/scanner.ts`
- Test: `tests/self-healing/scanner.test.ts`

**Interfaces:**
- Produces:
  - `type DiagnosticIssue = { code: string; title: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; autoHealable: boolean; details: Record<string, unknown> }`
  - `type DiagnosticReport = { timestamp: string; healthScore: number; totalIssues: number; issues: DiagnosticIssue[] }`
  - `async function runDiagnostics(deps: DiagnosticDependencies): Promise<DiagnosticReport>`

- [x] **Step 1: Write failing scanner unit tests**
  Create `tests/self-healing/scanner.test.ts` testing detection of:
  - Stale cache counts (cached count != live DB count)
  - Orphaned items (items referencing deleted category or location)
  - Duplicate serial/asset numbers (flagged as non-healable HIGH severity)
  - Healthy database reporting 100% health score.

- [x] **Step 2: Run test to verify failure**
  Run: `npx tsx --test tests/self-healing/scanner.test.ts`
  Expected: FAIL (modules not found)

- [x] **Step 3: Implement `types.ts` and `scanner.ts`**
  Implement pure, dependency-injected scanner functions so tests can run in-memory or against real database interfaces.

- [x] **Step 4: Run test to verify passing**
  Run: `npx tsx --test tests/self-healing/scanner.test.ts`
  Expected: All tests PASS.

---

### Task 2: Remediation Engine & Audit Logger

**Files:**
- Create: `lib/self-healing/audit.ts`
- Create: `lib/self-healing/healer.ts`
- Test: `tests/self-healing/healer.test.ts`

**Interfaces:**
- Consumes: `DiagnosticReport`, `DiagnosticIssue` from `lib/self-healing/types.ts`
- Produces:
  - `type HealingResult = { issueCode: string; status: 'SUCCESS' | 'SKIPPED' | 'FAILED'; actionTaken: string; auditId?: string }`
  - `async function healIssues(issues: DiagnosticIssue[], deps: HealerDependencies): Promise<HealingResult[]>`
  - `async function recordHealingAudit(entry: AuditEntry, deps: AuditDependencies): Promise<string>`

- [x] **Step 1: Write failing healer and audit unit tests**
  Create `tests/self-healing/healer.test.ts`:
  - Verifies `revalidate_cache` action calls cache revalidation and writes audit log.
  - Verifies `quarantine_orphans` reassigns broken foreign key to quarantine category and retains original note.
  - Verifies unhealable HIGH issues (`duplicate_serial`) are skipped with status `SKIPPED`.
  - Verifies audit logs record `action: 'SYSTEM_SELF_HEAL'`.

- [x] **Step 2: Run test to verify failure**
  Run: `npx tsx --test tests/self-healing/healer.test.ts`
  Expected: FAIL

- [x] **Step 3: Implement `audit.ts` and `healer.ts`**
  Implement safe healing actions and audit writing logic.

- [x] **Step 4: Run test to verify passing**
  Run: `npx tsx --test tests/self-healing/healer.test.ts`
  Expected: All tests PASS.

---

### Task 3: MCP Server Integration (`diagnose_system_health` & `heal_system_issues`)

**Files:**
- Modify: `scripts/mcp-server.ts:111-210`
- Modify: `scripts/mcp-server.test.ts:39-57`

**Interfaces:**
- Consumes: `runDiagnostics` from `lib/self-healing/scanner.ts`, `healIssues` from `lib/self-healing/healer.ts`
- Produces: MCP tools `diagnose_system_health` and `heal_system_issues` in `tools/list` and `tools/call`.

- [x] **Step 1: Write test for MCP diagnostic and healing tools**
  Update `scripts/mcp-server.test.ts` to assert that:
  - `tools/list` exposes `diagnose_system_health` (always) and `heal_system_issues` (when `writeEnabled` is true).
  - Calling `diagnose_system_health` returns a structured report with `healthScore`.

- [x] **Step 2: Run test to verify failure**
  Run: `npx tsx scripts/mcp-server.test.ts`
  Expected: FAIL (tools not in list)

- [x] **Step 3: Update `scripts/mcp-server.ts`**
  Add tool schema definitions and dispatch handling for `diagnose_system_health` and `heal_system_issues`.

- [x] **Step 4: Run test to verify passing**
  Run: `npx tsx scripts/mcp-server.test.ts`
  Expected: All tests PASS.

---

### Task 4: Automated Background CLI Runner

**Files:**
- Create: `scripts/self-healing-job.ts`
- Modify: `package.json:43-44`
- Test: `tests/self-healing/job.test.ts`

**Interfaces:**
- CLI:
  - `npm run health:diagnose` (runs diagnostic scan and outputs JSON/table summary)
  - `npm run health:heal` (runs diagnostic scan and auto-heals safe issues)

- [x] **Step 1: Write test for CLI runner**
  Create `tests/self-healing/job.test.ts` asserting CLI outputs appropriate exit codes and summary text.

- [x] **Step 2: Implement `scripts/self-healing-job.ts` & update `package.json`**
  Implement command-line arguments parsing (`--diagnose`, `--heal`, `--dry-run`), executing scanner/healer and reporting progress.

- [x] **Step 3: Verify CLI runner execution**
  Run: `npm run health:diagnose`
  Expected: Clean execution and output report.

---

### Task 5: Admin API Route & UI Status Endpoint

**Files:**
- Create: `app/api/admin/self-healing/route.ts`
- Test: `tests/self-healing/api.test.ts`

**Interfaces:**
- `GET /api/admin/self-healing`: Returns `{ healthScore, totalIssues, issues, lastHealedAt }`
- `POST /api/admin/self-healing`: Body `{ dryRun?: boolean }`, returns `{ results, healedCount }`

- [x] **Step 1: Write test for Admin API route**
  Create `tests/self-healing/api.test.ts` testing:
  - Rejection with 401/403 for unauthorized requests.
  - Successful report return for authorized requests.

- [x] **Step 2: Implement `app/api/admin/self-healing/route.ts`**
  Connect with Next.js session verification and invoke self-healing scanner/healer.

- [x] **Step 3: Run all project checks & tests**
  Run: `npm test` and `npx tsx scripts/mcp-server.test.ts`
  Expected: Full test suite passes without regressions.
