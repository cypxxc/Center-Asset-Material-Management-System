# Server Actions & Mutation Audit Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify and standardize all Server Action mutations (Items, Settings metadata, Admin User & DB operations) to automatically log structured audit records through `writeAuditLog`, ensuring consistent auditing across both Supabase and standalone PostgreSQL backends.

**Architecture:** Route mutation operations through audited Server Action pipelines. Standardize `writeAuditLog` integration across `features/items/actions.ts`, `features/settings/actions.ts`, `features/settings/postgres-actions.ts`, and `features/admin/actions.ts`. Ensure both PostgreSQL and Supabase paths maintain identical audit semantics, action tracing, error boundary responses, and cache invalidation.

**Tech Stack:** Next.js Server Actions ('use server'), TypeScript, Supabase / Drizzle ORM (PostgreSQL), Node:test, Zod.

## Global Constraints

- Do not break existing public Server Action signatures or return types (`ActionResponse`, `{ error?: string, success?: boolean }`).
- Preserve dual-backend compatibility (`isPostgresBackend()` branch vs Supabase client branch).
- Audit records must include `operation`, `feature`, `userId`, `targetType`, `targetId`, `oldValues` (where available), and `newValues`.
- Tests must use `node:test` and `node:assert`.
- All tests must pass: `npm test`.

---

### Task 1: Audit Logging for Items Mutations (Hard Delete & Bulk Operations)

**Files:**
- Modify: `features/items/actions.ts:510-655`
- Test: `tests/integration/items-audit-mutations.test.ts`

**Interfaces:**
- Consumes: `writeAuditLog` from `@/lib/audit`, `getCurrentProfile` from `@/features/auth/queries`
- Produces: `hardDeleteItem`, `bulkDeleteItems`, `bulkHardDeleteItems`, `bulkUpdateItems` with consistent audit events

- [ ] **Step 1: Write integration tests for Item deletion and bulk mutation audit logs**

Create `tests/integration/items-audit-mutations.test.ts` testing that:
1. `bulkUpdateItems` issues audit log entries for updated items.
2. `bulkDeleteItems` issues audit log entries with target IDs.
3. `hardDeleteItem` issues audit log with deleted item metadata.
4. `bulkHardDeleteItems` issues audit log with deleted items metadata.

- [ ] **Step 2: Run test to verify initial failures or coverage gap**

Run: `node --import tsx --test tests/integration/items-audit-mutations.test.ts`

- [ ] **Step 3: Update `features/items/actions.ts` to log audit events on bulk and hard deletes**

In `features/items/actions.ts`:
- In `bulkDeleteItems`: add `writeAuditLog` with `operation: 'delete'`, `targetType: 'items'`, `newValues: { ids, count: ids.length }`.
- In `hardDeleteItem`: ensure `writeAuditLog` is called with `operation: 'hard_delete'`, `targetType: 'items'`, `targetId: id`, `oldValues: item`.
- In `bulkHardDeleteItems`: add `writeAuditLog` with `operation: 'bulk_hard_delete'`, `targetType: 'items'`, `newValues: { ids, count: ids.length }`.
- In `bulkUpdateItems`: add `writeAuditLog` with `operation: 'bulk_update'`, `targetType: 'items'`, `newValues: { ids: parsed.data.ids, updates: parsed.data.updates, count }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/items-audit-mutations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/items/actions.ts tests/integration/items-audit-mutations.test.ts
git commit -m "feat(items): add audit logging to bulk operations and hard delete"
```

---

### Task 2: Audit Logging for Settings Metadata Mutations in PostgreSQL Backend

**Files:**
- Modify: `features/settings/postgres-actions.ts:38-74`
- Test: `tests/integration/settings-postgres-audit.test.ts`

**Interfaces:**
- Consumes: `writeAuditLog` from `@/lib/audit`, `getCurrentProfile` from `@/features/auth/queries`
- Produces: `mutatePostgresMetadata` issuing audit records on create, update, delete

- [ ] **Step 1: Write unit/integration tests for `mutatePostgresMetadata` audit logging**

Create `tests/integration/settings-postgres-audit.test.ts` testing that:
1. Metadata creations (`create`) emit audit log with `operation: 'create'`, `feature: 'settings'`, `targetType: table`.
2. Metadata updates (`update`) emit audit log with `operation: 'update'`, `targetType: table`, `targetId: id`.
3. Metadata deletions (`delete`) emit audit log with `operation: 'delete'`, `targetType: table`, `targetId: id`.

- [ ] **Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/integration/settings-postgres-audit.test.ts`

- [ ] **Step 3: Update `features/settings/postgres-actions.ts`**

Import `writeAuditLog` from `@/lib/audit` in `features/settings/postgres-actions.ts`.
In `mutatePostgresMetadata`:
- Before or after committing transaction, log audit event via `writeAuditLog({ operation, feature: 'settings', userId: profile.id, targetType: table, targetId: id, newValues: values ?? undefined })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/settings-postgres-audit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/settings/postgres-actions.ts tests/integration/settings-postgres-audit.test.ts
git commit -m "feat(settings): add audit logging to mutatePostgresMetadata"
```

---

### Task 3: Unify Admin Actions Audit Logging and Error Handling

**Files:**
- Modify: `features/admin/actions.ts:80-165`
- Test: `tests/integration/admin-actions-audit.test.ts`

**Interfaces:**
- Consumes: `writeAuditLog` from `@/lib/audit`
- Produces: `upsertTableRow`, `deleteTableRow` using `writeAuditLog` instead of raw direct table insert, maintaining uniform metadata (request context, trace, IP)

- [ ] **Step 1: Write integration tests for Admin DB Panel actions audit logging**

Create `tests/integration/admin-actions-audit.test.ts` testing that:
1. `upsertTableRow` (insert & update) records audit logs via `writeAuditLog`.
2. `deleteTableRow` records audit logs via `writeAuditLog` with `oldValues`.

- [ ] **Step 2: Run test to verify failure/status**

Run: `node --import tsx --test tests/integration/admin-actions-audit.test.ts`

- [ ] **Step 3: Refactor `features/admin/actions.ts` to use `writeAuditLog`**

Replace direct `supabase.from('audit_logs').insert(...)` in `upsertTableRow` and `deleteTableRow` with `writeAuditLog`:
- For update: `writeAuditLog({ operation: 'UPDATE', feature: 'admin', userId: auth.profile.id, targetType: safeTable, targetId: rowId, newValues: cleanPayload })`
- For insert: `writeAuditLog({ operation: 'INSERT', feature: 'admin', userId: auth.profile.id, targetType: safeTable, targetId: newId, newValues: cleanPayload })`
- For delete: `writeAuditLog({ operation: 'DELETE', feature: 'admin', userId: auth.profile.id, targetType: safeTable, targetId: rowId, oldValues: oldRow })`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/admin-actions-audit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/admin/actions.ts tests/integration/admin-actions-audit.test.ts
git commit -m "refactor(admin): standardize audit logging using writeAuditLog in db panel actions"
```

---

### Task 4: Full Test Suite Verification and Regression Gate

**Files:**
- Verify across repository: `npm test`

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Verify git status and clean tree**

Run: `git status`
Expected: Clean working tree.
