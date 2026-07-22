# Phased Cleanup Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a clean, type-safe verification baseline, remove confirmed dead dependencies/code, and harden logging, health, admin, and MCP boundaries without changing successful public contracts.

**Architecture:** This is the first independently deployable sub-project from the approved phased-cleanup design. It uses characterization tests before runtime changes, keeps Next.js Server Action and route signatures stable, and isolates privileged validation in small pure modules that can be tested without request context.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, TypeScript 5.9 strict, Node 24, Supabase JS/SSR, Zod 4, Node test runner via `tsx`, ESLint 9, Tailwind CSS 4.

## Global Constraints

- Treat the current dirty working tree as user-owned baseline; never stage unrelated changes.
- Read the relevant guide in `node_modules/next/dist/docs/` before changing Next.js route, cache, Server Action, or proxy behavior.
- Preserve public routes, Server Action signatures, response shapes, Thai UI copy, environment-variable names, RLS behavior, and soft-delete/status filters.
- Never delete, rewrite, or squash migrations and seeds.
- Prefer `createClient()` and RLS; service-role access remains restricted to existing privileged operations.
- Every task follows TDD: failing focused test, minimal implementation, focused pass, full verification, focused commit.
- Before every commit run `git diff --cached --check` and verify `git diff --cached --name-only` lists only that task's files.
- This plan does not implement distributed rate limiting, export pagination, item/settings mutation consolidation, or UI component decomposition; those require separate plans after this foundation passes.

## File Map

- `package.json`, `package-lock.json`: direct dependency hygiene and strict typecheck command.
- `scripts/release-e2e.test.ts`, `tests/integration/admin-performance.test.ts`: current strict TypeScript fixture failures.
- `components/ui/loading-overlay.tsx`, `loading-spinner.tsx`, `skeleton-card.tsx`, `skeleton-table.tsx`, `zoomable-image.tsx`: confirmed unused React imports only.
- `lib/logging/formatter.ts`, `tests/unit/logging.test.ts`: sanitize payload and error fields through one pure sanitizer.
- `lib/health/checks.ts`, `app/api/health/readiness/route.ts`, `tests/unit/health.test.ts`: retain internal diagnostics but redact public readiness output.
- `features/admin/table-policy.ts`: new pure allowlist and operation policy for privileged table access.
- `features/admin/actions.ts`, `tests/integration/admin-table-policy.test.ts`: enforce the table policy after admin authorization.
- `scripts/mcp-policy.ts`: new pure MCP capability and Zod input validation module.
- `scripts/mcp-server.ts`, `scripts/mcp-policy.test.ts`: explicit write capability and validated MCP write arguments.
- `features/items/queries.ts`, `features/items/actions.ts`, `features/settings/actions.ts`, `features/admin/actions.ts`, `tests/integration/locations.test.ts`: remove the confirmed no-op cache API and calls.
- `app/globals.css`, `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`: confirmed unreferenced CSS/assets, subject to final reference scan.

---

### Task 1: Make Strict Type Checking a Reliable Gate

**Files:**
- Modify: `package.json`
- Modify: `scripts/release-e2e.test.ts`
- Modify: `tests/integration/admin-performance.test.ts`
- Modify: `components/ui/loading-overlay.tsx`
- Modify: `components/ui/loading-spinner.tsx`
- Modify: `components/ui/skeleton-card.tsx`
- Modify: `components/ui/skeleton-table.tsx`
- Modify: `components/ui/zoomable-image.tsx`

**Interfaces:**
- Produces: npm script `typecheck` executing `tsc --noEmit --noUnusedLocals --noUnusedParameters`.
- Produces: typed test fixture helper `env(overrides?: Record<string, string>): NodeJS.ProcessEnv` local to `scripts/release-e2e.test.ts`.

- [ ] **Step 1: Record the existing strict type failures**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`

Expected: FAIL only for unused React imports, `NodeJS.ProcessEnv` fixtures in `scripts/release-e2e.test.ts`, and the inferred backup fixture in `admin-performance.test.ts`.

- [ ] **Step 2: Make ProcessEnv fixtures explicit**

Add near the imports in `scripts/release-e2e.test.ts`:

```ts
function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...overrides }
}
```

Wrap every object passed to `validateReleaseE2EEnv`, `getE2EInvocation`, and `getWebServerConfig` with `env(...)`; use `env()` instead of `{}`.

- [ ] **Step 3: Give the backup assertion a stable interface**

In `tests/integration/admin-performance.test.ts`, replace direct inferred optional chaining with:

```ts
type BackupResult = {
  error?: string
  backup?: { items?: Array<{ id: string }> }
}

const result = await exportDatabaseData() as BackupResult
```

Keep the timing and value assertions unchanged.

- [ ] **Step 4: Remove only unused default React imports**

Delete `import React from 'react'` or the unused `React` binding in the five listed UI files. Do not change JSX, props, exports, or component behavior.

- [ ] **Step 5: Add the strict typecheck script**

Add to `package.json#scripts`:

```json
"typecheck": "tsc --noEmit --noUnusedLocals --noUnusedParameters"
```

Do not add a new package; use the existing TypeScript dependency.

- [ ] **Step 6: Verify the new gate**

Run: `npm run typecheck`

Expected: PASS with exit code 0 and no diagnostics.

Run: `node --import tsx --test scripts/release-e2e.test.ts tests/integration/admin-performance.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit the isolated gate fix**

```powershell
git add -- package.json scripts/release-e2e.test.ts tests/integration/admin-performance.test.ts components/ui/loading-overlay.tsx components/ui/loading-spinner.tsx components/ui/skeleton-card.tsx components/ui/skeleton-table.tsx components/ui/zoomable-image.tsx
git diff --cached --check
git commit -m "test: enforce strict project typecheck"
```

Rollback: revert this commit; no runtime or data migration is involved.

### Task 2: Sanitize Error Diagnostics Before Logging

**Files:**
- Modify: `tests/unit/logging.test.ts`
- Modify: `lib/logging/formatter.ts`

**Interfaces:**
- Produces: private `sanitizeValue(value: unknown): unknown` used for payload, error message, and error stack.
- Preserves: `formatLog(level: string, payload: LogPayload, err?: unknown): string`.

- [ ] **Step 1: Add failing tests for error fields**

Append to `tests/unit/logging.test.ts`:

```ts
test('formatLog sanitizes secrets in Error message and stack', () => {
  const secret = 'sbp_1234567890abcdef1234567890abcdef'
  const error = new Error(`connection failed with ${secret}`)
  error.stack = `Error: ${secret}\n at test`

  const result = JSON.parse(formatLog('ERROR', { operation: 'test', feature: 'logging' }, error))

  assert.equal(result.error_message, 'connection failed with [KEY_REDACTED]')
  assert.equal(result.error_stack, 'Error: [KEY_REDACTED]\n at test')
  assert.equal(JSON.stringify(result).includes(secret), false)
})

test('formatLog sanitizes non-Error diagnostic strings', () => {
  const result = JSON.parse(formatLog(
    'ERROR',
    { operation: 'test', feature: 'logging' },
    'token eyJabcdefghij.abcdefghij.abcdefghij',
  ))
  assert.equal(result.error_message.includes('eyJabcdefghij'), false)
})
```

- [ ] **Step 2: Confirm the leak is reproduced**

Run: `node --import tsx --test tests/unit/logging.test.ts`

Expected: FAIL because `error_message` and `error_stack` contain the original secret.

- [ ] **Step 3: Route error fields through the sanitizer**

In `formatLog`, compute sanitized diagnostics before `logLine`:

```ts
const rawErrorMessage = errorObj ? errorObj.message : err ? String(err) : undefined
const rawErrorStack = errorObj?.stack
const errorMessage = sanitizeValue(rawErrorMessage) as string | undefined
const errorStack = sanitizeValue(rawErrorStack) as string | undefined
```

Then assign `error_message: errorMessage` and `error_stack: errorStack`. Keep structured payload sanitization and log keys unchanged.

- [ ] **Step 4: Verify focused and full logging behavior**

Run: `node --import tsx --test tests/unit/logging.test.ts`

Expected: all logging tests PASS.

Run: `npm run typecheck && npm run lint`

Expected: both PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- tests/unit/logging.test.ts lib/logging/formatter.ts
git diff --cached --check
git commit -m "fix: redact secrets from error logs"
```

Rollback: revert the commit; log JSON keys and caller interfaces remain unchanged.

### Task 3: Redact Public Readiness Diagnostics

**Files:**
- Modify: `tests/unit/health.test.ts`
- Modify: `lib/health/checks.ts`
- Modify: `app/api/health/readiness/route.ts`

**Interfaces:**
- Produces: `toPublicReadiness(result: ReadinessResult): ReadinessResult` with errors replaced by `Dependency check failed`.
- Preserves: `checkReadiness()` full internal result and readiness HTTP status semantics.

- [ ] **Step 1: Add a failing route redaction test**

Append to `tests/unit/health.test.ts`:

```ts
test('/api/health/readiness does not expose dependency errors', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('profiles', null, {
    message: 'connection failed with SUPABASE_SERVICE_ROLE_KEY=secret',
  })

  const response = await readiness()
  const body = await response.json()

  assert.equal(response.status, 503)
  assert.equal(body.checks.database.status, 'down')
  assert.equal(body.checks.database.error, 'Dependency check failed')
  assert.equal(JSON.stringify(body).includes('SUPABASE_SERVICE_ROLE_KEY'), false)
})
```

- [ ] **Step 2: Verify the current endpoint exposes the message**

Run: `node --import tsx --test tests/unit/health.test.ts`

Expected: the new test FAILS on the raw database error.

- [ ] **Step 3: Add a pure public projection**

Add to `lib/health/checks.ts`:

```ts
function publicCheck(check: DependencyCheck): DependencyCheck {
  return check.status === 'down'
    ? { status: 'down', latencyMs: check.latencyMs, error: 'Dependency check failed' }
    : check
}

export function toPublicReadiness(result: ReadinessResult): ReadinessResult {
  return {
    ...result,
    checks: {
      database: publicCheck(result.checks.database),
      storage: publicCheck(result.checks.storage),
      environment: publicCheck(result.checks.environment),
    },
  }
}
```

In the readiness route, compute `const publicResult = toPublicReadiness(result)`, return `publicResult`, and continue deriving HTTP status from `result.ready`.

- [ ] **Step 4: Verify health contracts**

Run: `node --import tsx --test tests/unit/health.test.ts`

Expected: all health tests PASS; legacy `/api/health` remains aggregate-only.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- tests/unit/health.test.ts lib/health/checks.ts app/api/health/readiness/route.ts
git diff --cached --check
git commit -m "fix: redact readiness diagnostics"
```

Rollback: revert the commit; probe status codes and readiness calculation are unchanged.

### Task 4: Enforce an Admin Database Table Policy

**Files:**
- Create: `features/admin/table-policy.ts`
- Create: `tests/integration/admin-table-policy.test.ts`
- Modify: `features/admin/actions.ts`

**Interfaces:**
- Produces: `type AdminTable = 'profiles' | 'categories' | 'locations' | 'units' | 'items' | 'audit_logs'`.
- Produces: `assertAdminTable(value: string, operation: 'read' | 'write' | 'delete'): AdminTable`.
- Preserves existing exported action names and parameters.

- [ ] **Step 1: Write policy tests**

Create `tests/integration/admin-table-policy.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAdminTable } from '@/features/admin/table-policy'

test('admin table policy permits registry tables', () => {
  assert.equal(assertAdminTable('items', 'read'), 'items')
  assert.equal(assertAdminTable('categories', 'write'), 'categories')
  assert.equal(assertAdminTable('audit_logs', 'delete'), 'audit_logs')
})

test('admin table policy rejects tables outside the registry contract', () => {
  assert.throws(() => assertAdminTable('auth.users', 'read'), /Unsupported admin table/)
  assert.throws(() => assertAdminTable('storage.objects', 'delete'), /Unsupported admin table/)
})
```

- [ ] **Step 2: Confirm the module does not exist**

Run: `node --import tsx --test tests/integration/admin-table-policy.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the allowlist**

Create `features/admin/table-policy.ts`:

```ts
const ADMIN_TABLES = [
  'profiles', 'categories', 'locations', 'units', 'items', 'audit_logs',
] as const

export type AdminTable = (typeof ADMIN_TABLES)[number]

export function assertAdminTable(
  value: string,
  _operation: 'read' | 'write' | 'delete',
): AdminTable {
  if (!(ADMIN_TABLES as readonly string[]).includes(value)) {
    throw new Error('Unsupported admin table')
  }
  return value as AdminTable
}
```

- [ ] **Step 4: Apply policy after `requireAdmin()`**

In `getTableData`, `upsertTableRow`, and `deleteTableRow`, call:

```ts
await requireAdmin()
const safeTable = assertAdminTable(tableName, 'read') // use write/delete respectively
```

Use `safeTable` for `.from(...)`, sorting, audit `target_table`, and metadata-cache checks. Do not change SQL-console behavior; `runAdminSql` remains protected by its existing feature flag and RPC permissions.

- [ ] **Step 5: Verify authorization and table policy**

Run: `node --import tsx --test tests/integration/admin-table-policy.test.ts tests/integration/admin-performance.test.ts`

Expected: PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- features/admin/table-policy.ts tests/integration/admin-table-policy.test.ts features/admin/actions.ts
git diff --cached --check
git commit -m "fix: restrict admin database tables"
```

Rollback: revert the commit; no table or policy migration is performed.

### Task 5: Require Explicit MCP Write Capability and Validate Inputs

**Files:**
- Create: `scripts/mcp-policy.ts`
- Create: `scripts/mcp-policy.test.ts`
- Modify: `scripts/mcp-server.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `isMcpWriteEnabled(env: NodeJS.ProcessEnv): boolean` requiring `CAMMS_MCP_ALLOW_WRITE === 'true'` and a service-role key.
- Produces: `parseMcpCreateItem(input: unknown)` and `parseMcpUpdateItem(input: unknown)` backed by strict Zod schemas.
- Preserves MCP tool names and JSON-RPC response envelope; write calls return a tool error when disabled.

- [ ] **Step 1: Write capability and validation tests**

Create `scripts/mcp-policy.test.ts` with these assertions:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { isMcpWriteEnabled, parseMcpCreateItem, parseMcpUpdateItem } from './mcp-policy'

test('MCP writes require both explicit opt-in and service role', () => {
  assert.equal(isMcpWriteEnabled({ NODE_ENV: 'test' }), false)
  assert.equal(isMcpWriteEnabled({ NODE_ENV: 'test', CAMMS_MCP_ALLOW_WRITE: 'true' }), false)
  assert.equal(isMcpWriteEnabled({
    NODE_ENV: 'test', CAMMS_MCP_ALLOW_WRITE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  }), true)
})

test('MCP create rejects unknown fields and invalid quantity', () => {
  assert.throws(() => parseMcpCreateItem({ item_name: 'A', item_type: 'asset', quantity: 0 }))
  assert.throws(() => parseMcpCreateItem({ item_name: 'A', item_type: 'asset', quantity: 1, role: 'admin' }))
})

test('MCP update requires id and at least one approved field', () => {
  assert.throws(() => parseMcpUpdateItem({ id: 'not-a-uuid', updates: {} }))
})
```

- [ ] **Step 2: Verify tests fail before policy exists**

Run: `node --import tsx --test scripts/mcp-policy.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement strict Zod schemas**

Create `scripts/mcp-policy.ts` using `z.strictObject(...)`. Use `z.uuid()` for IDs, `z.enum(['asset', 'material'])`, `z.number().int().min(1)` for quantity, nullable UUIDs for optional relation IDs, and `.check()` or `.refine()` to require at least one update field. Export only the three interfaces listed above.

- [ ] **Step 4: Gate writes before database calls**

In `scripts/mcp-server.ts`:

```ts
const writeEnabled = isMcpWriteEnabled(process.env)

function requireMcpWriteCapability() {
  if (!writeEnabled) {
    throw new Error('MCP write tools are disabled')
  }
}
```

Call it first in `create_item`, `update_item`, and `delete_item`. Parse create/update arguments through the new schema before `pickItemFields`. Validate delete IDs with `z.uuid()` or an exported delete parser. Keep list/get tools available with the anon key and keep `revalidate_cache` unchanged.

- [ ] **Step 5: Make tool discovery reflect capability**

Build the `tools/list` result so write tools are included only when `writeEnabled` is true. Read tools remain listed. This avoids advertising operations that cannot run.

- [ ] **Step 6: Document the opt-in**

Add to the MCP section of `README.md`:

```md
MCP starts read-only by default. To expose create/update/delete tools, set
`CAMMS_MCP_ALLOW_WRITE=true` together with `SUPABASE_SERVICE_ROLE_KEY` in the
local process environment. Never expose the stdio process to untrusted callers.
```

- [ ] **Step 7: Verify policy and server compilation**

Run: `node --import tsx --test scripts/mcp-policy.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- scripts/mcp-policy.ts scripts/mcp-policy.test.ts scripts/mcp-server.ts README.md
git diff --cached --check
git commit -m "fix: make MCP writes explicit and validated"
```

Rollback: revert the commit. Users needing legacy local writes can temporarily run the prior revision; no database change is required.

### Task 6: Make Name Login Deterministic and Preserve Upload Diagnostics

**Files:**
- Create: `features/auth/login-identifier.ts`
- Create: `features/auth/login-identifier.test.ts`
- Modify: `features/auth/actions.ts`
- Modify: `features/items/actions.ts`
- Modify: `tests/integration/create-item.test.ts`

**Interfaces:**
- Produces: `resolveUniqueProfileEmail(rows: Array<{ email: string | null }>): string | null`.
- Preserves the generic invalid-credentials response for absent and ambiguous names.
- Preserves the existing safe Thai upload error while adding server-side structured diagnostics.

- [ ] **Step 1: Characterize unique and ambiguous name resolution**

Create `features/auth/login-identifier.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveUniqueProfileEmail } from './login-identifier'

test('name login resolves exactly one profile email', () => {
  assert.equal(resolveUniqueProfileEmail([{ email: 'staff@example.com' }]), 'staff@example.com')
})

test('name login rejects absent, missing-email, and ambiguous profiles', () => {
  assert.equal(resolveUniqueProfileEmail([]), null)
  assert.equal(resolveUniqueProfileEmail([{ email: null }]), null)
  assert.equal(resolveUniqueProfileEmail([
    { email: 'first@example.com' }, { email: 'second@example.com' },
  ]), null)
})
```

- [ ] **Step 2: Verify the helper is missing**

Run: `node --import tsx --test features/auth/login-identifier.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exact-one resolution**

Create `features/auth/login-identifier.ts`:

```ts
export function resolveUniqueProfileEmail(
  rows: Array<{ email: string | null }>,
): string | null {
  if (rows.length !== 1) return null
  return rows[0]?.email ?? null
}
```

In the non-email/non-UUID branch of `features/auth/actions.ts`, change `.limit(1)` to `.limit(2)` and resolve with `resolveUniqueProfileEmail(profiles ?? [])`. When it returns `null`, return the same generic invalid-credentials message currently used for profile-not-found. Do not reveal whether the name was missing or duplicated.

- [ ] **Step 4: Add a failing upload diagnostic assertion**

In `tests/integration/create-item.test.ts`, add a storage-upload failure case using the existing Supabase mock registry. Temporarily replace `console.error`, invoke `createItem`, restore it in `finally`, and assert both conditions:

```ts
assert.match(result.message ?? '', /ผิดพลาด/)
assert.equal(logLines.some((line) => line.includes('uploadItemImage')), true)
assert.equal(logLines.some((line) => line.includes('service-role')), false)
```

Configure the storage mock to reject with `new Error('service-role diagnostic')`; the exact secret phrase must not appear after Task 2 sanitization.

- [ ] **Step 5: Verify upload diagnostics currently fail**

Run: `node --import tsx --test tests/integration/create-item.test.ts`

Expected: the new diagnostic assertion FAILS because `handleImageUpload` catches without logging.

- [ ] **Step 6: Log the original upload error safely**

Change the upload handler catch to:

```ts
} catch (error) {
  logger.error({
    operation: 'uploadItemImage',
    feature: 'items',
    details: 'Failed to process or upload item image',
  }, error)
  return { imageUrl: null, error: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์รูปภาพ' }
}
```

Keep the existing user-facing Thai string exactly as stored in the source file; do not replace encoding or surrounding upload behavior.

- [ ] **Step 7: Verify both behaviors**

Run: `node --import tsx --test features/auth/login-identifier.test.ts tests/integration/create-item.test.ts`

Expected: PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- features/auth/login-identifier.ts features/auth/login-identifier.test.ts features/auth/actions.ts features/items/actions.ts tests/integration/create-item.test.ts
git diff --cached --check
git commit -m "fix: harden identity and upload diagnostics"
```

Rollback: revert the commit. Email/UUID login and successful uploads are not modified.

### Task 7: Remove the No-Op Reference Cache API

**Files:**
- Modify: `features/items/queries.ts`
- Modify: `features/items/actions.ts`
- Modify: `features/settings/actions.ts`
- Modify: `features/admin/actions.ts`
- Modify: `tests/integration/locations.test.ts`

**Interfaces:**
- Removes: `clearReferencesCache(): void`, a confirmed no-op.
- Preserves: `revalidateTag(CACHE_TAGS.ITEM_REFERENCES, ...)`, sidebar tags, and layout revalidation.

- [ ] **Step 1: Replace the no-op test with contract evidence**

Remove the import and test named `clearReferencesCache runs successfully without throwing` from `tests/integration/locations.test.ts`. Confirm the remaining settings/item tests assert observable updated data or cache tag behavior; do not add a test that merely checks another no-op.

- [ ] **Step 2: Remove all imports and calls**

Run first: `rg -n "clearReferencesCache" features tests scripts app components`

Expected: definition, four production imports/calls, and one test reference.

Delete the function from `features/items/queries.ts` and remove every import/call. Do not remove adjacent `revalidateTag`, `revalidatePath`, or `revalidateSidebarCache` calls.

- [ ] **Step 3: Confirm zero references**

Run: `rg -n "clearReferencesCache" features tests scripts app components`

Expected: no output, exit code 1.

- [ ] **Step 4: Verify mutation and cache-sensitive tests**

Run: `node --import tsx --test tests/integration/locations.test.ts tests/integration/settings.test.ts tests/integration/create-item.test.ts tests/integration/import-items.test.ts tests/integration/admin-performance.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- features/items/queries.ts features/items/actions.ts features/settings/actions.ts features/admin/actions.ts tests/integration/locations.test.ts
git diff --cached --check
git commit -m "refactor: remove no-op reference cache API"
```

Rollback: revert the commit; reintroducing the function has no cache effect.

### Task 8: Remove Confirmed Unused Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Removes direct runtime dependencies: `@hookform/resolvers`, `@tanstack/react-table`, `react-hook-form`.
- Adds direct development dependency: `dotenv`, already imported by migration/readiness/seed scripts.

- [ ] **Step 1: Re-run whole-repository reference checks**

Run:

```powershell
rg -n --glob '!node_modules/**' --glob '!.next/**' "@hookform/resolvers|@tanstack/react-table|react-hook-form" .
rg -n --glob '!node_modules/**' --glob '!.next/**' "from ['\"]dotenv['\"]|require\(['\"]dotenv['\"]\)" .
```

Expected: removed dependencies appear only in package metadata; `dotenv` appears in operational scripts.

- [ ] **Step 2: Update dependency metadata with npm**

Run: `npm uninstall @hookform/resolvers @tanstack/react-table react-hook-form`

Expected: package and lockfile updated without forced peer changes.

Run: `npm install --save-dev dotenv@17.4.2`

Expected: the already-resolved lockfile version becomes an explicit dev dependency.

- [ ] **Step 3: Verify dependency tree**

Run: `npm ls @hookform/resolvers @tanstack/react-table react-hook-form dotenv --depth=0`

Expected: only `dotenv@17.4.2` is listed at depth 0; removed packages are absent.

- [ ] **Step 4: Verify application and scripts**

Run: `npm run typecheck && npm test && npm run lint && npm run build`

Expected: all commands PASS and bundle budget remains at or below 450 KB raw shared runtime.

- [ ] **Step 5: Commit**

```powershell
git add -- package.json package-lock.json
git diff --cached --check
git commit -m "chore: remove unused form and table dependencies"
```

Rollback: revert the commit and run `npm install`.

### Task 9: Remove Confirmed Unreferenced CSS and Default Assets

**Files:**
- Modify: `app/globals.css`
- Delete: `public/file.svg`
- Delete: `public/globe.svg`
- Delete: `public/next.svg`
- Delete: `public/vercel.svg`
- Delete: `public/window.svg`

**Interfaces:**
- Removes only private CSS selectors and static assets with no discovered consumer.

- [ ] **Step 1: Reconfirm references including non-code files**

Run:

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' "table-row-hover|table-row-selected|file\.svg|globe\.svg|next\.svg|vercel\.svg|window\.svg" .
```

Expected: only the CSS definitions and asset files themselves. If any config, manifest, metadata, CSS URL, or documentation consumer appears, remove that asset from this task.

- [ ] **Step 2: Delete the dead selectors and confirmed assets**

Remove `.table-row-hover`, `.table-row-hover:hover`, and `.table-row-selected` from `app/globals.css`. Delete only the five listed SVG files that passed Step 1.

- [ ] **Step 3: Verify build and critical page rendering**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: PASS.

Run: `npm run test:smoke`

Expected: smoke project PASS with no missing-asset responses.

- [ ] **Step 4: Commit**

```powershell
git add -- app/globals.css public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
git diff --cached --check
git commit -m "chore: remove unreferenced styles and assets"
```

Rollback: revert the commit; no generated or database artifact is affected.

### Task 10: Foundation Release Verification and Report

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-phased-cleanup-foundation-report.md`

**Interfaces:**
- Produces a review artifact containing exact results, changed/deleted files, dependencies, deferred risks, and rollback commits.

- [ ] **Step 1: Run the complete local gate**

Run: `npm run verify-env && npm run typecheck && npm test && npm run lint && npm run build`

Expected: every command PASS; record test count and bundle-budget values verbatim.

- [ ] **Step 2: Run browser verification**

Run: `npm run test:smoke`

Expected: PASS.

If real release credentials are configured, also run `npm run test:e2e:release`; otherwise record it as `NOT RUN — credentials not configured`, not as PASS.

- [ ] **Step 3: Run database readiness without changing schema**

Run: `npm run verify-db-release`

Expected: PASS for migrations, RLS, RPC grants, and required database capabilities. Do not apply migrations in this task.

- [ ] **Step 4: Re-run dependency/security diagnostics**

Run: `npm audit --omit=dev --audit-level=high`

Expected: record the actual result. Existing unresolved upstream advisories are documented; never run `npm audit fix --force`.

Run: `npm ls --depth=0`

Expected: dependency tree is valid.

- [ ] **Step 5: Write the report with evidence**

Create the report with these headings and actual values—never placeholders:

```md
# Phased Cleanup Foundation Report

## Files Modified
## Files Deleted
## Dependencies Removed or Added
## Security Issues Fixed
## Dead Code Removed
## Behavior Preserved
## Verification Results
## Deferred Findings and Risks
## Rollback Commits
```

For each implementation commit, include original problem, reason, concise before/after excerpt, impact, test evidence, and `git revert <hash>` rollback command.

- [ ] **Step 6: Commit the evidence report**

```powershell
git add -- docs/superpowers/plans/2026-07-22-phased-cleanup-foundation-report.md
git diff --cached --check
git commit -m "docs: report cleanup foundation verification"
```

## Subsequent Independent Plans

After this foundation is reviewed and accepted, write and approve these plans separately:

1. `phased-cleanup-item-mutations` — characterize and consolidate `createItem`/`createItemInline`, image lifecycle, audit, metrics, and cache behavior.
2. `phased-cleanup-settings-mutations` — consolidate category/location/unit mutation pipelines without dynamic table trust or copy changes.
3. `phased-cleanup-query-export-utilities` — extract only proven-equivalent filter/sort/export pure functions.
4. `phased-cleanup-component-decomposition` — DB panel, item explorer/form, header/sidebar, and page-to-feature query alignment with Playwright verification.
5. `phased-cleanup-operations` — distributed rate limiting, bounded exports/backups, query plans/indexes, bundle headroom, and unresolved dependency advisories.

Each later plan starts from a fully passing foundation and can be rejected, rolled back, or deployed independently.
