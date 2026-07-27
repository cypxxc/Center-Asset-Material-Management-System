# Mutation, Audit, and Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make administrator deletion safe, item mutation results exact and atomically audited, and rate limiting shared across all application instances.

**Architecture:** Add narrowly scoped Postgres RPCs for transactional item mutations and a service-role-only rate-limit RPC. Keep authorization at both the server-action and database boundaries, validate all caller input before RPC calls, and derive user-visible counts from rows returned by Postgres.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript strict mode, Zod 4, Supabase Auth/Postgres/RLS, Node test runner through `tsx`.

## Global Constraints

- Follow `node_modules/next/dist/docs/` for Next.js 16 APIs.
- Use `createClient()` for user-scoped RPCs and service role only for Auth administration and the private distributed limiter.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or raw rate-limit identities to clients or logs.
- All new public RPCs must use `SECURITY DEFINER SET search_path = ''`, qualify every object, perform internal authorization, revoke `PUBLIC` and `anon`, and receive only minimum grants.
- Database deployment is forward-only and database-first; apply only the explicitly named new migration.
- Maximum bulk item mutation size is 100 unique UUIDs.
- User-facing messages remain Thai-first and do not expose raw database errors.

---

### Task 1: Item mutation input contract

**Files:**
- Create: `features/items/mutation-input.ts`
- Create: `features/items/mutation-input.test.ts`
- Modify: `features/items/schema.ts`

**Interfaces:**
- Produces: `parseMutationIds(ids: string[]): { ok: true; ids: string[] } | { ok: false; message: string }`
- Produces: `parseBulkItemUpdates(input: unknown): { ok: true; updates: { location_id?: string | null; status?: ItemStatus } } | { ok: false; message: string }`
- Consumes: `itemStatusSchema` from `features/items/schema.ts`.

- [ ] **Step 1: Write failing validation tests**

```ts
test('parseMutationIds deduplicates valid UUIDs and preserves first-seen order', () => {
  assert.deepEqual(parseMutationIds([A, A, B]), { ok: true, ids: [A, B] })
})

test('parseMutationIds rejects empty, malformed, and more than 100 unique IDs', () => {
  assert.equal(parseMutationIds([]).ok, false)
  assert.equal(parseMutationIds(['not-a-uuid']).ok, false)
  assert.equal(parseMutationIds(makeIds(101)).ok, false)
})

test('parseBulkItemUpdates rejects empty and unsupported updates', () => {
  assert.equal(parseBulkItemUpdates({}).ok, false)
  assert.equal(parseBulkItemUpdates({ status: 'invented' }).ok, false)
  assert.equal(parseBulkItemUpdates({ location_id: 'bad' }).ok, false)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test features/items/mutation-input.test.ts`

Expected: FAIL because `mutation-input.ts` and its exports do not exist.

- [ ] **Step 3: Implement minimal Zod-backed parsers**

```ts
const MAX_BULK_ITEMS = 100
const uuidSchema = z.string().uuid()
const bulkUpdatesSchema = z.object({
  location_id: uuidSchema.nullable().optional(),
  status: itemStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)
```

Normalize with `new Set(ids)`, reject before any database call, and return stable Thai messages.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx tsx --test features/items/mutation-input.test.ts`

Expected: all mutation-input tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/items/mutation-input.ts features/items/mutation-input.test.ts features/items/schema.ts
git commit -m "test: define safe item mutation inputs"
```

### Task 2: Transactional mutation and distributed limiter migration

**Files:**
- Create: `db/migrations/00032_mutation_audit_rate_limit_hardening.sql`
- Modify: `tests/integration/release-migrations.test.ts`
- Modify: `scripts/verify-database-readiness.ts`

**Interfaces:**
- Produces RPCs:
  - `public.update_items_with_audit(p_ids uuid[], p_updates jsonb)`
  - `public.soft_delete_items_with_audit(p_ids uuid[])`
  - `public.restore_items_with_audit(p_ids uuid[])`
  - `public.hard_delete_items_with_audit(p_ids uuid[])`
  - `public.consume_rate_limit(p_key_hash text, p_limit integer, p_window_ms integer)`
- Item RPCs return `id`, `image_url`, `item_name`, `asset_no`, and `serial_no` as applicable.
- Rate-limit RPC returns `allowed boolean`, `remaining integer`, and `reset_at timestamptz`.

- [ ] **Step 1: Extend migration contract tests and verify RED**

```ts
const migration32 = readFileSync('db/migrations/00032_mutation_audit_rate_limit_hardening.sql', 'utf8')

test('mutation RPCs authorize internally and deny public execution', () => {
  for (const name of ['update_items_with_audit', 'soft_delete_items_with_audit', 'restore_items_with_audit', 'hard_delete_items_with_audit']) {
    assert.match(migration32, new RegExp(`FUNCTION public\\.${name}`))
    assert.match(migration32, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}`))
  }
  assert.match(migration32, /SET search_path = ''/)
  assert.match(migration32, /private\.current_app_role\(\) IN \('admin', 'staff'\)/i)
})

test('rate limiter is private and callable only by service role', () => {
  assert.match(migration32, /CREATE TABLE private\.rate_limit_windows/i)
  assert.match(migration32, /GRANT EXECUTE .*consume_rate_limit.* TO service_role/is)
  assert.doesNotMatch(migration32, /GRANT EXECUTE .*consume_rate_limit.* TO authenticated/is)
})
```

Run: `npx tsx --test tests/integration/release-migrations.test.ts`

Expected: FAIL because migration 00032 does not exist.

- [ ] **Step 2: Create the migration with atomic item functions**

Each item RPC must use this structure:

```sql
CREATE OR REPLACE FUNCTION public.restore_items_with_audit(p_ids uuid[])
RETURNS TABLE (id uuid, image_url text, item_name text, asset_no text, serial_no text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL OR private.current_app_role() NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH changed AS (
    UPDATE public.items i SET deleted_at = NULL, deleted_by = NULL,
      updated_by = caller_id, updated_at = now()
    WHERE i.id = ANY(p_ids) AND i.deleted_at IS NOT NULL
    RETURNING i.id, i.image_url, i.item_name, i.asset_no, i.serial_no
  ), audited AS (
    INSERT INTO public.audit_logs (user_id, action, target_table, target_id, new_data)
    SELECT caller_id, 'restore', 'items', changed.id, jsonb_build_object('deleted_at', NULL)
    FROM changed
  )
  SELECT changed.* FROM changed;
END;
$$;
```

Use equivalent CTEs for update, soft delete, and hard delete. Validate operation-specific state in the `WHERE` clause and use returned row IDs for audits. Reject arrays larger than 100 inside every RPC as defense in depth.

- [ ] **Step 3: Add the atomic shared rate-limit function**

Create `private.rate_limit_windows` with `key_hash text` primary key, `window_started_at`, `request_count`, and `expires_at`. `public.consume_rate_limit` validates bounds, opportunistically removes at most 1000 expired rows, and atomically inserts/updates the current key using `INSERT ... ON CONFLICT ... DO UPDATE`. Revoke execution from `PUBLIC`, `anon`, and `authenticated`; grant only to `service_role`.

- [ ] **Step 4: Record migration and expand readiness checks**

Add `00032_mutation_audit_rate_limit_hardening.sql` to `requiredMigrations`. Extend the ACL query to all five new public RPCs and assert item RPCs are unavailable to `anon`, rate limiting is unavailable to `anon`/`authenticated`, and required RPCs exist.

- [ ] **Step 5: Run migration tests and verify GREEN**

Run: `npx tsx --test tests/integration/release-migrations.test.ts scripts/migration-utils.test.ts`

Expected: all migration contract and parser tests pass.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/00032_mutation_audit_rate_limit_hardening.sql tests/integration/release-migrations.test.ts scripts/verify-database-readiness.ts
git commit -m "feat: add atomic mutation and rate limit RPCs"
```

### Task 3: Exact and atomically audited item actions

**Files:**
- Modify: `features/items/actions.ts`
- Modify: `tests/mocks/supabase.ts`
- Modify: `tests/integration/delete-item.test.ts`
- Modify: `tests/integration/restore-item.test.ts`
- Create: `tests/integration/bulk-item-mutations.test.ts`

**Interfaces:**
- Consumes Task 1 parsers and Task 2 RPCs.
- Keeps existing exported Server Action signatures and `ActionResponse` shape.

- [ ] **Step 1: Write failing zero-row and exact-result tests**

```ts
test('restoreItem reports not found when RPC changes zero rows', async () => {
  mockSupabaseRegistry.setRpcResponse('restore_items_with_audit', [])
  const result = await restoreItem(A)
  assert.equal(result.ok, false)
})

test('bulkDeleteItems reports and audits only returned rows', async () => {
  mockSupabaseRegistry.setRpcResponse('soft_delete_items_with_audit', [{ id: B }])
  const result = await bulkDeleteItems([A, B])
  assert.equal(result.ok, true)
  assert.match(result.message ?? '', /1 รายการ/)
})

test('bulkHardDeleteItems removes storage by returned row id without positional matching', async () => {
  mockSupabaseRegistry.setRpcResponse('hard_delete_items_with_audit', [{ id: B, image_url: IMAGE_B }])
  await bulkHardDeleteItems([A, B])
  assert.equal(mockSupabaseRegistry.getStorageLog()[0]?.path, expectedStoragePathB)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/integration/delete-item.test.ts tests/integration/restore-item.test.ts tests/integration/bulk-item-mutations.test.ts`

Expected: FAIL because actions still use direct table mutations and caller ID counts.

- [ ] **Step 3: Extend the mock only as required by real RPC behavior**

Retain RPC argument logging and allow each RPC response to contain exact affected rows. Do not emulate production branching in the mock.

- [ ] **Step 4: Replace direct mutations with RPC calls**

For each action:

```ts
const parsedIds = parseMutationIds(ids)
if (!parsedIds.ok) return errorResponse(parsedIds.message)
const { data, error } = await supabase.rpc('soft_delete_items_with_audit', { p_ids: parsedIds.ids })
if (error) return safeMutationError(...)
const affected = mutationRows(data)
if (affected.length === 0) return errorResponse('ไม่พบรายการที่สามารถดำเนินการได้')
return successResponse(`ลบเรียบร้อย ${affected.length} รายการ`)
```

Remove duplicate application-side item audit inserts for these operations. Derive storage cleanup from hard-delete RPC rows and log cleanup failures without changing the committed mutation response.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command; expect all item mutation tests to pass.

- [ ] **Step 6: Run the complete test suite**

Run: `npm test`

Expected: all tests pass with no regression in create/edit/import behavior.

- [ ] **Step 7: Commit**

```bash
git add features/items/actions.ts tests/mocks/supabase.ts tests/integration/delete-item.test.ts tests/integration/restore-item.test.ts tests/integration/bulk-item-mutations.test.ts
git commit -m "fix: make item mutation outcomes exact"
```

### Task 4: Safe administrator deletion

**Files:**
- Modify: `features/admin/actions.ts`
- Create: `tests/integration/admin-users.test.ts`
- Modify: `tests/mocks/supabase.ts`

**Interfaces:**
- Keeps `deleteAuthUser(userId: string)`.
- Adds no client-visible service-role operations.

- [ ] **Step 1: Write failing safeguard tests**

```ts
test('deleteAuthUser rejects the acting administrator ID', async () => {
  const result = await deleteAuthUser(ACTING_ADMIN)
  assert.match(result.error ?? '', /บัญชีของตนเอง/)
  assert.equal(mockSupabaseRegistry.getAdminAuthLog().length, 0)
})

test('deleteAuthUser rejects the last active administrator', async () => {
  mockSupabaseRegistry.setTableResponse('profiles', [TARGET_ADMIN])
  mockSupabaseRegistry.setCountResponse('profiles', 0)
  const result = await deleteAuthUser(TARGET_ADMIN.id)
  assert.match(result.error ?? '', /ผู้ดูแลระบบคนสุดท้าย/)
})

test('deleteAuthUser rejects malformed and missing targets before Auth deletion', async () => {
  assert.equal((await deleteAuthUser('bad')).error !== undefined, true)
  mockSupabaseRegistry.setTableResponse('profiles', [])
  assert.equal((await deleteAuthUser(UNKNOWN)).error !== undefined, true)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/integration/admin-users.test.ts`

Expected: FAIL because safeguards and Auth Admin mock logging do not exist.

- [ ] **Step 3: Add minimal Auth Admin mock support**

Add `deleteUser`, `getUserById`, and an admin-auth call log to `tests/mocks/supabase.ts`. Keep configured results explicit per test.

- [ ] **Step 4: Implement server-side safeguards and checked audit**

Validate UUID, compare actor and target IDs, fetch the target with service role, and count other active admins only when target is an active admin. Check profile deletion and audit insert errors. Return safe Thai errors and do not expose Supabase messages.

- [ ] **Step 5: Run focused and full tests**

Run: `npx tsx --test tests/integration/admin-users.test.ts`

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add features/admin/actions.ts tests/integration/admin-users.test.ts tests/mocks/supabase.ts
git commit -m "fix: protect administrator account deletion"
```

### Task 5: Shared fail-closed rate limiting

**Files:**
- Create: `lib/rate-limit/identity.ts`
- Create: `lib/rate-limit/supabase-rate-limiter.ts`
- Modify: `lib/rate-limit/index.ts`
- Modify: `lib/rate-limit/types.ts`
- Modify: `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Produces `canonicalClientIp(headers: Headers): string`.
- Produces `hashRateLimitIdentity(value: string): Promise<string>`.
- Produces `SupabaseRateLimiter` implementing `RateLimiter` through `consume_rate_limit`.
- `checkRateLimit` returns failure when identity lookup or RPC consumption fails.

- [ ] **Step 1: Write failing identity and distributed limiter tests**

```ts
test('canonicalClientIp accepts the first valid forwarded IP only', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
  assert.equal(canonicalClientIp(headers), '203.0.113.7')
})

test('canonicalClientIp rejects arbitrary forwarded text', () => {
  assert.equal(canonicalClientIp(new Headers({ 'x-forwarded-for': 'spoof' })), 'unknown')
})

test('SupabaseRateLimiter maps consume_rate_limit output', async () => {
  mockSupabaseRegistry.setRpcResponse('consume_rate_limit', [{ allowed: false, remaining: 0, reset_at: RESET }])
  const result = await new SupabaseRateLimiter().limit('identity', 2, 60_000)
  assert.deepEqual(result, { success: false, remaining: 0, reset: Date.parse(RESET) })
})

test('checkRateLimit fails closed when the limiter RPC fails', async () => {
  mockSupabaseRegistry.setRpcResponse('consume_rate_limit', null, { message: 'down' })
  const result = await checkRateLimit('login')
  assert.equal(result.success, false)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/unit/rate-limit.test.ts`

Expected: FAIL because shared identity and limiter modules do not exist.

- [ ] **Step 3: Implement canonical identity hashing and RPC adapter**

Use `node:net` `isIP` for canonical validation and `crypto.subtle.digest('SHA-256', ...)` for hashing `${userId}:${ip}:${actionName}`. Pass only the hex digest, limit, and window to the service-role RPC. Remove the production memory singleton; retain `MemoryRateLimiter` only as an independently tested utility if other code still consumes it.

- [ ] **Step 4: Make `checkRateLimit` fail closed safely**

Return `{ success: false, error: 'ไม่สามารถตรวจสอบจำนวนคำขอได้ กรุณาลองใหม่อีกครั้ง' }` on infrastructure failure and log only action name/reason. Never log raw IP or hash.

- [ ] **Step 5: Run focused and full tests**

Run: `npx tsx --test tests/unit/rate-limit.test.ts`

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/rate-limit/identity.ts lib/rate-limit/supabase-rate-limiter.ts lib/rate-limit/index.ts lib/rate-limit/types.ts tests/unit/rate-limit.test.ts
git commit -m "fix: enforce distributed rate limits"
```

### Task 6: Separate durable audit state from deferred telemetry

**Files:**
- Modify: `lib/audit.ts`
- Modify: `tests/unit/audit.test.ts`

**Interfaces:**
- Keeps `writeAuditLog(payload)` for best-effort telemetry-compatible persistence.
- Does not replace the transactional RPC audits introduced in Task 2.

- [ ] **Step 1: Write a failing status-semantics test**

Assert the immediate structured log uses a neutral status such as `scheduled` rather than `success`, and that a deferred database error produces an error log for `writeAuditLogDb`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test tests/unit/audit.test.ts`

Expected: FAIL because `writeAuditLog` currently emits `status: 'success'` before persistence.

- [ ] **Step 3: Implement minimal status correction**

Change only the premature success semantics. Keep `after(persist)` for non-critical telemetry and retain safe non-request fallback behavior.

- [ ] **Step 4: Run focused and full tests**

Run: `npx tsx --test tests/unit/audit.test.ts`

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/audit.ts tests/unit/audit.test.ts
git commit -m "fix: report deferred audit state accurately"
```

### Task 7: Full verification and controlled database release

**Files:**
- Modify if required by verified behavior: `DEPLOYMENT.md`
- Modify if required by verified behavior: `CHANGELOG.md`

**Interfaces:**
- Consumes migration `00032_mutation_audit_rate_limit_hardening.sql` and all prior tasks.

- [ ] **Step 1: Run local quality gates**

```powershell
npm run verify-env
npm test
npm run lint
npm run typecheck
npm run build
npm run audit:release
```

Expected: every command exits 0; tests report zero failures and bundle budgets remain within limits.

- [ ] **Step 2: Confirm the exact database target and recoverability**

Run `npm run verify-db-release` before changes and verify the configured Supabase project is the intended target. Confirm the project has a current recoverable backup/PITR point as documented in `BACKUP.md`. Stop if the target or recoverability cannot be confirmed.

- [ ] **Step 3: Apply only migration 00032**

```powershell
$env:MIGRATION_FILES='00032_mutation_audit_rate_limit_hardening.sql'
npx tsx scripts/apply-migrations.ts
```

Expected: one atomic migration applied and recorded; no other migration is replayed.

- [ ] **Step 4: Verify database grants and live RPC behavior**

Run: `npm run verify-db-release`

Use service-role test queries to confirm `consume_rate_limit` allows then denies at the configured threshold. Use an authenticated staging staff session to confirm a zero-match item RPC returns no rows and creates no audit record. Confirm `anon` cannot execute any new RPC.

- [ ] **Step 5: Run application health and browser gates**

```powershell
npm run test:smoke
npm run test:e2e:release
```

Expected: smoke passes and authenticated staging E2E completes without skips.

- [ ] **Step 6: Update release documentation only with observed facts**

Add migration 00032 and its readiness requirements to `DEPLOYMENT.md`; record the hardening change in `CHANGELOG.md`. Do not claim live deployment unless Steps 2-5 actually completed against the intended environment.

- [ ] **Step 7: Final verification and commit**

Re-run `git diff --check`, `git status --short`, focused migration tests, and any documentation checks. Commit only verified documentation changes:

```bash
git add DEPLOYMENT.md CHANGELOG.md
git commit -m "docs: record mutation security hardening"
```
