# Dead-Code Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-backed, repository-wide dead-code audit and an ordered, safe cleanup plan for CAMMS Portal without changing production code.

**Architecture:** Gather independent usage evidence in four layers—TypeScript/ESLint, Next.js conventions and dynamic entry points, delivery/test tooling, and database artifacts—then triangulate every candidate before classifying it. The audit report is the only artifact created by the execution; any code deletion is deferred to a separately approved cleanup task.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5 strict mode, ESLint 9, npm 11, Supabase PostgreSQL, PowerShell, ripgrep.

**Spec:** `docs/superpowers/specs/2026-08-28-dead-code-audit-design.md`

## Global Constraints

- Scope includes `app/`, `components/`, `features/`, `hooks/`, `lib/`, root configuration, `scripts/`, `tests/`, CI, `db/migrations/`, `db/seed.sql`, and runtime/development dependencies.
- Exclude `node_modules/`, `prototype/`, and `.agent/`.
- Never delete or rewrite a previously applied migration; classify obsolete migration artifacts as `Historical/immutable`.
- Treat Next.js convention files, dynamic imports, environment-driven references, CLI entry points, CI-only files, and package-tooling dependencies as live until evidence disproves it.
- Classify uncertain findings as `Needs confirmation`; only zero-reference, zero-convention, zero-delivery-dependency findings may be `Safe removal`.
- Do not modify application, test, configuration, migration, seed, or dependency files during this audit.

---

## Planned File Structure

- Create: `docs/superpowers/audits/2026-08-28-dead-code-audit.md` — final evidence table, classification decisions, and ordered cleanup batches.
- Create: `.cache/dead-code-audit/tsc-unused.txt` — captured TypeScript diagnostics; ignored local evidence.
- Create: `.cache/dead-code-audit/eslint.txt` — captured ESLint diagnostics; ignored local evidence.
- Create: `.cache/dead-code-audit/file-list.txt` — reproducible list of scoped source files.
- Create: `.cache/dead-code-audit/references.txt` — reproducible dynamic, route, package, and SQL reference searches.

### Task 1: Create a reproducible static-analysis evidence set

**Files:**
- Create: `.cache/dead-code-audit/file-list.txt`
- Create: `.cache/dead-code-audit/tsc-unused.txt`
- Create: `.cache/dead-code-audit/eslint.txt`
- Modify: none
- Test: TypeScript and ESLint exit status, captured without stopping evidence collection

**Interfaces:**
- Consumes: `tsconfig.json`, `eslint.config.mjs`, and the tracked source tree.
- Produces: diagnostics for Task 5; these diagnostics are leads only, not removal proof.

- [ ] **Step 1: Make the ignored evidence directory and capture the exact scoped file inventory**

Run:

```powershell
New-Item -ItemType Directory -Force .cache/dead-code-audit | Out-Null
rg --files app components features hooks lib scripts tests db .github -g '!node_modules' -g '!prototype' -g '!.agent' | Sort-Object | Set-Content .cache/dead-code-audit/file-list.txt
```

Expected: `file-list.txt` contains only files in the declared audit scope.

- [ ] **Step 2: Capture compiler diagnostics without changing files**

Run:

```powershell
npm run typecheck 2>&1 | Tee-Object .cache/dead-code-audit/tsc-unused.txt
```

Expected: all TypeScript failures, including unused locals/parameters enabled by the script, are retained in the evidence file even if the command exits nonzero.

- [ ] **Step 3: Capture lint diagnostics without changing files**

Run:

```powershell
npm run lint 2>&1 | Tee-Object .cache/dead-code-audit/eslint.txt
```

Expected: all ESLint findings are retained in the evidence file.

- [ ] **Step 4: Extract only dead-code-relevant leads for later review**

Run:

```powershell
rg -n -i 'declared but|unused|no-unused|is defined but never used' .cache/dead-code-audit/tsc-unused.txt .cache/dead-code-audit/eslint.txt
```

Expected: a concise list of compiler/linter candidates, or no output when neither tool identifies one.

- [ ] **Step 5: Commit the audit evidence policy only if the repository deliberately tracks audit evidence**

Run:

```powershell
git check-ignore -v .cache/dead-code-audit/file-list.txt
```

Expected: `.cache` is ignored. Do not force-add generated evidence; it must remain local.

### Task 2: Map framework, dynamic, and operational entry points

**Files:**
- Create: `.cache/dead-code-audit/references.txt`
- Modify: none
- Test: manual comparison of discovered references against framework entry points

**Interfaces:**
- Consumes: `app/`, `proxy.ts`, `instrumentation.ts`, `package.json`, `next.config.ts`, `vercel.json`, and `.github/workflows/ci.yml`.
- Produces: an allowlist of convention/dynamic/operational artifacts for Task 5.

- [ ] **Step 1: Record Next.js route and convention files**

Run:

```powershell
rg --files app -g 'page.tsx' -g 'layout.tsx' -g 'loading.tsx' -g 'error.tsx' -g 'not-found.tsx' -g 'route.ts' | Sort-Object | Tee-Object -FilePath .cache/dead-code-audit/references.txt
@('proxy.ts', 'instrumentation.ts', 'next.config.ts', 'vercel.json') | Where-Object { Test-Path $_ } | Add-Content .cache/dead-code-audit/references.txt
```

Expected: route and framework-convention files are explicitly marked as entry points, regardless of normal import counts.

- [ ] **Step 2: Record dynamic module and string-based runtime references**

Run:

```powershell
rg -n "dynamic\(|import\(|require\(|worker|register\(" app components features hooks lib scripts tests -g '!*.test.*' | Tee-Object -Append .cache/dead-code-audit/references.txt
```

Expected: every dynamic import target is added to the manual-review allowlist before a candidate can be removed.

- [ ] **Step 3: Record scripts, CI invocations, and package tooling dependencies**

Run:

```powershell
rg -n '"scripts"|npm run|npx |node |tsx |playwright|next |eslint|typescript' package.json .github scripts README.md DEPLOYMENT.md | Tee-Object -Append .cache/dead-code-audit/references.txt
```

Expected: package dependencies and scripts are checked against their command/config consumers, not source imports alone.

- [ ] **Step 4: Check package scripts resolve to existing local files**

Run:

```powershell
rg -o 'scripts/[A-Za-z0-9._/-]+\.ts' package.json | ForEach-Object { $_.Split(':')[-1] } | Sort-Object -Unique | ForEach-Object { "$(Test-Path $_)`t$_" }
```

Expected: every local script path prints `True`; a `False` result is a broken reference, not a dead-code deletion candidate.

### Task 3: Trace database and Supabase artifact usage

**Files:**
- Create: `.cache/dead-code-audit/database-references.txt`
- Modify: none
- Test: SQL/RPC reference cross-check against migrations and seed data

**Interfaces:**
- Consumes: `db/migrations/*.sql`, `db/seed.sql`, application Supabase calls, and database release scripts.
- Produces: a list of schema/RPC artifacts and their usage status for Task 5.

- [ ] **Step 1: Record migration ordering and duplicate numeric prefixes**

Run:

```powershell
Get-ChildItem db/migrations -Filter '*.sql' | Sort-Object Name | Select-Object -ExpandProperty Name | Tee-Object .cache/dead-code-audit/database-references.txt
Get-ChildItem db/migrations -Filter '*.sql' | Group-Object { $_.BaseName -replace '_.*$', '' } | Where-Object Count -gt 1 | ForEach-Object { "DUPLICATE_PREFIX`t$($_.Name)`t$($_.Group.Name -join ', ')" } | Tee-Object -Append .cache/dead-code-audit/database-references.txt
```

Expected: ordering anomalies are recorded as migration-history findings and never become deletion actions.

- [ ] **Step 2: Record application and script RPC calls**

Run:

```powershell
rg -n "\.rpc\(['\"][^'\"]+['\"]" app components features hooks lib scripts | Tee-Object -Append .cache/dead-code-audit/database-references.txt
```

Expected: every RPC called by application or operational code appears in the evidence file.

- [ ] **Step 3: Locate definitions and grants for each observed RPC**

Run:

```powershell
rg -n -i 'create( or replace)? function|grant execute|revoke execute' db/migrations db/seed.sql | Tee-Object -Append .cache/dead-code-audit/database-references.txt
```

Expected: Task 5 can distinguish an unused database artifact from an RPC required by application code.

- [ ] **Step 4: Record table/storage identifiers used outside SQL**

Run:

```powershell
rg -n "\.from\(['\"]|storage\.from\(['\"]" app components features hooks lib scripts tests | Tee-Object -Append .cache/dead-code-audit/database-references.txt
```

Expected: table and bucket consumers are documented before any schema-related judgment.

### Task 4: Audit test-only code and dependency reachability

**Files:**
- Create: `.cache/dead-code-audit/test-and-package-references.txt`
- Modify: none
- Test: compare test-runner discovery with tracked test files and package usage.

**Interfaces:**
- Consumes: `scripts/run-tests.ts`, `playwright.config.ts`, `tests/`, `features/**/*.test.*`, `lib/**/*.test.ts`, `scripts/**/*.test.ts`, `package.json`, and `package-lock.json`.
- Produces: verified test discovery and dependency-consumer evidence for Task 5.

- [ ] **Step 1: Reproduce the unit/component/integration test discovery patterns**

Run:

```powershell
rg --files features tests lib scripts -g '*.test.ts' -g '*.test.tsx' | Sort-Object | Tee-Object .cache/dead-code-audit/test-and-package-references.txt
```

Expected: each discovered test is compared with the explicit glob patterns in `scripts/run-tests.ts`; files outside those patterns are `Needs confirmation`, not removable by default.

- [ ] **Step 2: Record Playwright discovery and external runner references**

Run:

```powershell
rg -n 'testDir|testMatch|smoke|e2e|playwright' playwright.config.ts scripts package.json .github tests | Tee-Object -Append .cache/dead-code-audit/test-and-package-references.txt
```

Expected: E2E and smoke files are judged by Playwright configuration and scripts, not the Node test runner.

- [ ] **Step 3: Record dependency names and all textual consumers**

Run:

```powershell
node -e "const p=require('./package.json'); console.log([...Object.keys(p.dependencies||{}), ...Object.keys(p.devDependencies||{})].sort().join('\n'))" | Tee-Object -Append .cache/dead-code-audit/test-and-package-references.txt
rg -n 'from |import\(|require\(|extends|plugins|parser|tsx|playwright|eslint|tailwind|postcss' app components features hooks lib scripts tests *.ts *.mjs *.json .github -g '!package-lock.json' | Tee-Object -Append .cache/dead-code-audit/test-and-package-references.txt
```

Expected: dependency removal candidates have both absent source usage and absent script/config/toolchain usage.

### Task 5: Triangulate candidates and publish the audit report

**Files:**
- Create: `docs/superpowers/audits/2026-08-28-dead-code-audit.md`
- Modify: none
- Test: report completeness and repository quality gates

**Interfaces:**
- Consumes: all files under `.cache/dead-code-audit/`, `git ls-files`, source-tree search results, and the classification rules in the spec.
- Produces: the approved input to a future cleanup implementation plan.

- [ ] **Step 1: Create the report with an explicit methodology and classification legend**

Write `docs/superpowers/audits/2026-08-28-dead-code-audit.md` with these headings:

```markdown
# Dead-Code Audit — 2026-08-28

## Scope and Method

## Classification Rules

## Findings

| Candidate | Area | Evidence | Classification | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- |

## Ordered Cleanup Batches

## Retained or Needs-Confirmation Artifacts

## Migration History Findings

## Validation Record
```

Expected: the legend defines `Safe removal`, `Needs confirmation`, `Historical/immutable`, and `Active` exactly as in the approved spec.

- [ ] **Step 2: Verify every prospective `Safe removal` candidate with three independent checks**

For each candidate, run its exact-name repository search, its path search, and one area-specific check:

```powershell
rg -n --fixed-strings '<candidate-symbol-or-package>' -g '!node_modules' -g '!prototype' -g '!.agent'
rg -n --fixed-strings '<candidate-path>' -g '!node_modules' -g '!prototype' -g '!.agent'
```

Area-specific checks are: Task 2 references for framework/tooling files, Task 3 references for database artifacts, and Task 4 references for test/dependency artifacts. Record the commands' results in the finding's Evidence cell. Any nonzero uncertainty changes classification to `Needs confirmation`.

- [ ] **Step 3: Produce ordered, reversible cleanup batches without performing deletion**

For each `Safe removal` finding, add one batch entry ordered as follows: unused leaf tests/helpers first, unused application modules second, unused scripts/config third, dependency uninstall last. State the exact files/package to remove, imports/configuration to update, and the minimum validation command after that batch.

Expected: no migration appears in a deletion batch; all migration observations are under `Migration History Findings`.

- [ ] **Step 4: Validate the audit did not alter product code and run the quality gates**

Run:

```powershell
git diff -- app components features hooks lib scripts tests db package.json package-lock.json tsconfig.json eslint.config.mjs next.config.ts playwright.config.ts proxy.ts instrumentation.ts
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: the Git diff shows no product-code/configuration/dependency edits from this audit; all quality gates pass. If a pre-existing failure occurs, record the command, failure, and whether it is unrelated to the audit in `Validation Record`.

- [ ] **Step 5: Review and commit the report only**

Run:

```powershell
$auditPlaceholderTerms = @('T' + 'BD', 'T' + 'ODO', 'implement later', 'fill in details', 'appropriate error handling', 'write tests for the above')
rg -n -i ($auditPlaceholderTerms -join '|') docs/superpowers/audits/2026-08-28-dead-code-audit.md
git add -f docs/superpowers/audits/2026-08-28-dead-code-audit.md
git commit -m "docs: add dead-code audit report"
```

Expected: the scan has no matches; the single commit contains only the final audit report.

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover every required project area; Task 5 provides evidence, classification, risk, ordered removals, validation, and migration protection.
- Placeholder check: The plan contains no unresolved requirements; `<candidate-symbol-or-package>` and `<candidate-path>` are explicitly per-candidate command arguments in the report-production procedure, not missing implementation details.
- Interface consistency: Tasks 1–4 produce the evidence files explicitly consumed by Task 5. The only versioned result of execution is the report, and no application code is changed.
