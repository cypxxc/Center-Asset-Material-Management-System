# Repository Health Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align local and CI tooling, eliminate generated Playwright noise, reject future migration-number collisions without changing deployed history, and restore initial JavaScript bundle headroom.

**Architecture:** Static contract tests protect repository configuration and migration naming before runtime work begins. The two historical `00018` migrations are represented as a narrow immutable compatibility exception, while every later duplicate number fails validation. A large optional header guide is moved behind a Next.js client-side dynamic import so dashboard navigation remains immediate and unchanged.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Node.js 20.19+, npm 11.14.1, Node test runner through `tsx`, Playwright 1.61.

## Global Constraints

- Preserve all unrelated uncommitted work in the current working tree.
- Do not rename either historical `00018` migration or change its SQL.
- Do not execute migrations, connect to production, mutate remote data, or modify secrets.
- Do not raise the existing 450 KB raw or 150 KB gzip shared-runtime limits; add 160 KB raw and 50 KB gzip dashboard-route limits.
- Read `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` and `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` before changing the client boundary.
- Keep Thai-first labels, keyboard behavior, roles, and route behavior unchanged.

---

### Task 1: Toolchain and generated-artifact contracts

**Files:**
- Modify: `scripts/ci-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `README.md`
- Untrack: `test-results/.last-run.json`

**Interfaces:**
- Produces: `packageJson.engines.node === ">=20.19.0 <21"` and `packageJson.packageManager === "npm@11.14.1"`.
- Produces: `/test-results/` as the repository-wide Playwright output ignore rule.

- [ ] **Step 1: Add failing repository contract tests**

Extend the parsed package type and read `.gitignore` in `scripts/ci-contract.test.ts`:

```ts
const gitignore = readFileSync('.gitignore', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
  engines?: { node?: string }
  packageManager?: string
}

test('repository pins the CI runtime and ignores Playwright output', () => {
  assert.equal(packageJson.engines?.node, '>=20.19.0 <21')
  assert.equal(packageJson.packageManager, 'npm@11.14.1')
  assert.match(gitignore, /^\/test-results\/$/m)
})
```

- [ ] **Step 2: Verify the contract fails for the missing metadata**

Run: `node --import tsx --test scripts/ci-contract.test.ts`

Expected: FAIL because `engines.node`, `packageManager`, and `/test-results/` are absent.

- [ ] **Step 3: Add toolchain metadata and ignore generated output**

Add these top-level fields after `private` in `package.json`:

```json
"engines": {
  "node": ">=20.19.0 <21"
},
"packageManager": "npm@11.14.1"
```

Add this testing rule to `.gitignore`:

```gitignore
/test-results/
```

Run `npm install --package-lock-only` to synchronize the root package metadata in `package-lock.json`. Update `README.md` requirements to `Node.js 20.19.x` and `npm 11.14.1`.

- [ ] **Step 4: Stop tracking the generated result file and rerun the test**

Run:

```powershell
git rm --cached -- test-results/.last-run.json
node --import tsx --test scripts/ci-contract.test.ts
git check-ignore -v test-results/.last-run.json
```

Expected: contract tests PASS; `git check-ignore` reports the `/test-results/` rule. The local result file may remain on disk.

- [ ] **Step 5: Commit only Task 1 files**

```powershell
git add -- package.json package-lock.json .gitignore README.md scripts/ci-contract.test.ts
git commit -m "chore: align runtime and ignore test artifacts"
```

---

### Task 2: Backward-compatible migration-number validation

**Files:**
- Modify: `scripts/migration-utils.test.ts`
- Modify: `scripts/migration-utils.ts`
- Modify: `scripts/apply-migrations.ts`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Produces: `validateAvailableMigrationNumbers(available: string[]): void`.
- Consumes: the complete sorted SQL filename list read by `scripts/apply-migrations.ts` before `validateMigrationOrder`.
- Preserves: `validateMigrationOrder(requested: string[], available: string[]): void`.

- [ ] **Step 1: Write failing tests for the immutable legacy exception and a new collision**

Import `validateAvailableMigrationNumbers` and add:

```ts
test('migration numbers allow only the historical 00018 pair', () => {
  assert.doesNotThrow(() =>
    validateAvailableMigrationNumbers([
      '00018_allow_staff_manage_metadata.sql',
      '00018_import_items_bulk_tx_line_errors.sql',
      '00019_add_sidebar_order_to_profiles.sql',
    ]),
  )

  assert.throws(
    () => validateAvailableMigrationNumbers(['00032_first.sql', '00032_second.sql']),
    /Duplicate migration number 00032: 00032_first\.sql, 00032_second\.sql/,
  )
})
```

- [ ] **Step 2: Verify the new test fails before implementation**

Run: `node --import tsx --test scripts/migration-utils.test.ts`

Expected: FAIL because `validateAvailableMigrationNumbers` is not exported.

- [ ] **Step 3: Implement the pure filename validator**

Add to `scripts/migration-utils.ts`:

```ts
const LEGACY_DUPLICATE_MIGRATIONS = new Set([
  '00018_allow_staff_manage_metadata.sql',
  '00018_import_items_bulk_tx_line_errors.sql',
])

export function validateAvailableMigrationNumbers(available: string[]): void {
  const filesByNumber = new Map<string, string[]>()

  for (const file of available) {
    const match = /^(\d{5})_[a-z0-9_]+\.sql$/.exec(file)
    if (!match) throw new Error(`Invalid migration filename: ${file}`)
    const files = filesByNumber.get(match[1]) ?? []
    files.push(file)
    filesByNumber.set(match[1], files)
  }

  for (const [number, files] of filesByNumber) {
    if (files.length < 2) continue
    const isLegacyPair =
      files.length === LEGACY_DUPLICATE_MIGRATIONS.size &&
      files.every((file) => LEGACY_DUPLICATE_MIGRATIONS.has(file))
    if (!isLegacyPair) {
      throw new Error(`Duplicate migration number ${number}: ${files.sort().join(', ')}`)
    }
  }
}
```

- [ ] **Step 4: Call validation before any database client or SQL execution**

In `scripts/apply-migrations.ts`, import the validator and invoke it immediately after reading and sorting available `.sql` filenames:

```ts
validateAvailableMigrationNumbers(availableMigrations)
validateMigrationOrder(requestedMigrations, availableMigrations)
```

Ensure `createClient`, RPC calls, and statement execution occur only after both validations.

- [ ] **Step 5: Document the compatibility exception and verify focused behavior**

Add to `DEPLOYMENT.md`: the two `00018` filenames are a frozen historical exception, must never be renamed, and all new migrations require a unique five-digit prefix.

Run:

```powershell
node --import tsx --test scripts/migration-utils.test.ts tests/integration/release-migrations.test.ts
git diff --check -- scripts/migration-utils.ts scripts/migration-utils.test.ts scripts/apply-migrations.ts DEPLOYMENT.md
```

Expected: all focused tests PASS and no whitespace errors.

- [ ] **Step 6: Commit only Task 2 files**

```powershell
git add -- scripts/migration-utils.ts scripts/migration-utils.test.ts scripts/apply-migrations.ts DEPLOYMENT.md
git commit -m "fix: reject new migration number collisions"
```

---

### Task 3: Defer the optional header guide from initial JavaScript

**Files:**
- Read first: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`
- Read first: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Create: `components/layout/header-guide-dialog.tsx`
- Create: `tests/component/header-guide-dialog.test.tsx`
- Modify: `components/layout/header.tsx`
- Modify: `tests/unit/bundle-budget.test.ts`
- Modify: `scripts/check-bundle-budget.ts`

**Interfaces:**
- Produces: `HeaderGuideDialog({ onClose }: { onClose: () => void }): React.ReactElement`.
- `Header` dynamically imports `HeaderGuideDialog` and mounts it only while `showGuide === true`.
- Bundle output reports and enforces 150 KB gzip/450 KB raw shared-runtime limits and 50 KB gzip/160 KB raw dashboard-route limits.

- [ ] **Step 1: Read the installed Next.js 16 client-boundary and lazy-loading guides**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
```

Expected: confirm `next/dynamic` is declared at module scope and `ssr: false` is valid inside the existing Client Component.

- [ ] **Step 2: Add failing behavior and budget-contract tests**

Create `tests/component/header-guide-dialog.test.tsx`:

```tsx
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { HeaderGuideDialog } from '../../components/layout/header-guide-dialog'

test('HeaderGuideDialog renders the guide and closes accessibly', () => {
  let closeCount = 0
  render(React.createElement(HeaderGuideDialog, { onClose: () => { closeCount += 1 } }))
  assert.ok(screen.getByText('คู่มือการใช้งานระบบทะเบียนสิ่งของ (CAMMS User Guide)'))
  fireEvent.click(screen.getByRole('button', { name: 'ปิดคู่มือการใช้งาน' }))
  assert.equal(closeCount, 1)
})
```

Extend `tests/unit/bundle-budget.test.ts` with:

```ts
assert.match(stdout, /Shared runtime JS \(raw\): .* \/ 450\.00 KB/)
assert.match(stdout, /Dashboard route JS \(raw\): .* \/ 160\.00 KB/)
assert.match(stdout, /Dashboard route JS \(gzip transfer\): .* \/ 50\.00 KB/)
```

Add `readFileSync` to `tests/unit/bundle-budget.test.ts`, then add:

```ts
test('header guide is deferred from the initial dashboard client boundary', () => {
  const headerSource = readFileSync('components/layout/header.tsx', 'utf8')
  assert.match(headerSource, /dynamic\(\s*\(\) => import\('\.\/header-guide-dialog'\)/)
  assert.doesNotMatch(headerSource, /CAMMS User Guide/)
})
```

- [ ] **Step 3: Verify the extracted component test fails**

Run:

```powershell
node --import tsx --test tests/component/header-guide-dialog.test.tsx
node --import tsx --test tests/unit/bundle-budget.test.ts
```

Expected: FAIL because the component does not exist and the header still contains the guide markup.

- [ ] **Step 4: Extract the existing guide without changing content or behavior**

Move the complete guide overlay currently guarded by `showGuide` in `components/layout/header.tsx` into `components/layout/header-guide-dialog.tsx`. Replace both `setShowGuide(false)` handlers with `onClose()`. Keep the existing Thai copy, icons, focusable controls, classes, backdrop, and close semantics unchanged.

At module scope in `header.tsx`, add:

```tsx
import dynamic from 'next/dynamic'

const HeaderGuideDialog = dynamic(
  () => import('./header-guide-dialog').then((module) => module.HeaderGuideDialog),
  { ssr: false },
)
```

Replace the inline overlay with:

```tsx
{showGuide && <HeaderGuideDialog onClose={() => setShowGuide(false)} />}
```

- [ ] **Step 5: Measure App Router dashboard chunks and enforce both budget families**

Add dashboard budgets without changing the shared-runtime values:

```ts
const BUDGETS = {
  shared_runtime_raw_max: 450 * 1024,
  shared_runtime_gzip_max: 150 * 1024,
  dashboard_route_raw_max: 160 * 1024,
  dashboard_route_gzip_max: 50 * 1024,
}
```

Read `.next/server/app/(dashboard)/dashboard/page_client-reference-manifest.js`, parse the JSON assigned to `globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"]`, flatten and deduplicate `entryJSFiles`, and resolve those files beneath `.next/`. Report shared runtime and dashboard route separately. Check all four limits independently and set `process.exitCode = 1` if any limit is exceeded. Missing or malformed dashboard manifest data must be an error, not a skipped success.

- [ ] **Step 6: Verify behavior and require measurable bundle improvement**

Run:

```powershell
node --import tsx --test tests/component/header-guide-dialog.test.tsx tests/unit/bundle-budget.test.ts
npm run build
```

Expected: tests PASS; production build PASS; shared runtime remains within 450 KB raw/150 KB gzip; dashboard route remains within 160 KB raw/50 KB gzip and improves from the recorded baseline of 144.45 KB raw/40.13 KB gzip. Confirm the new deferred guide chunk is not listed in dashboard `entryJSFiles`; do not raise budgets if validation fails.

- [ ] **Step 7: Commit only Task 3 files**

```powershell
git add -- components/layout/header.tsx components/layout/header-guide-dialog.tsx tests/component/header-guide-dialog.test.tsx tests/unit/bundle-budget.test.ts scripts/check-bundle-budget.ts
git commit -m "perf: defer optional header guide"
```

---

### Task 4: Full verification and release handoff

**Files:**
- Modify only if results require corrections: files already listed in Tasks 1–3
- Verify: `README.md`, `DEPLOYMENT.md`, `docs/deploy-readiness.md`

**Interfaces:**
- Confirms local gates only; protected staging credentials remain external release inputs.

- [ ] **Step 1: Confirm tests no longer dirty the repository with Playwright output**

Record `git status --short`, run `npm run test:smoke`, then run `git status --short` again.

Expected: no new `test-results/` entries and no tracked changes caused by Playwright output.

- [ ] **Step 2: Run the complete local quality gate**

Run: `npm run check`

Expected: environment validation passes; all Node tests pass; ESLint passes; Next.js TypeScript and production build pass; gzip and raw bundle budgets pass.

- [ ] **Step 3: Audit production dependencies**

Run: `npm run audit:release`

Expected: exit 0 with zero high or critical production vulnerabilities.

- [ ] **Step 4: Verify final scope and documentation**

Run:

```powershell
git diff --check
git status --short --branch
git log -5 --oneline
```

Expected: no whitespace errors; only pre-existing unrelated changes remain uncommitted; task commits are visible and do not include secrets or `test-results/`.

- [ ] **Step 5: Report protected release gates without running them locally**

Handoff must state that `npm run test:e2e:release` requires protected staging authentication and `npm run verify-db-release` requires the intended migrated target. Do not report release readiness until an operator runs both successfully against staging.
