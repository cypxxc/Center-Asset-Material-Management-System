# Release Dependency Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two high-severity production dependency advisories and provide a repository-local Node 20 runtime selector.

**Architecture:** Keep the existing direct dependency constraints intact and let npm select patched compatible transitive releases in the lockfile. Enforce the local Node selector through the existing repository CI contract test so it cannot silently drift from the supported Node 20 line.

**Tech Stack:** Node.js 20.19.5, npm 11.14.1, npm lockfile v3, Node test runner with TypeScript/tsx.

## Global Constraints

- Do not use `npm audit fix --force`.
- Do not perform broad or semver-major direct-dependency upgrades.
- Preserve all pre-existing user changes in the working tree.
- Accept only lockfile changes produced within the constraints already declared in `package.json`.
- The production audit must report no high-severity findings.

---

### Task 1: Pin the Local Node Runtime

**Files:**
- Create: `.nvmrc`
- Modify: `scripts/ci-contract.test.ts`
- Test: `scripts/ci-contract.test.ts`

**Interfaces:**
- Consumes: the existing `package.json` engine constraint `>=20.19.0 <21`.
- Produces: a repository-local runtime selector containing exactly `20.19.5` and a contract test that guards it.

- [ ] **Step 1: Extend the toolchain contract test before creating `.nvmrc`**

Add this top-level read beside the existing `package.json` and `.gitignore` reads:

```ts
const nvmrc = readFileSync('.nvmrc', 'utf8').trim()
```

Add this assertion to `repository pins the supported Node and npm toolchain and ignores test artifacts`:

```ts
assert.equal(nvmrc, '20.19.5')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --import tsx --test scripts/ci-contract.test.ts`

Expected: FAIL because `.nvmrc` does not exist.

- [ ] **Step 3: Add the runtime selector**

Create `.nvmrc` with exactly:

```text
20.19.5
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --import tsx --test scripts/ci-contract.test.ts`

Expected: all tests in `scripts/ci-contract.test.ts` PASS.

- [ ] **Step 5: Commit the runtime pin**

```powershell
git add -- .nvmrc scripts/ci-contract.test.ts
git commit -m "chore: pin local Node 20 runtime"
```

### Task 2: Remediate Compatible Transitive Dependencies

**Files:**
- Modify: `package-lock.json`
- Inspect only: `package.json`

**Interfaces:**
- Consumes: the dependency ranges and overrides already declared in `package.json`.
- Produces: a lockfile resolving patched `brace-expansion` and `js-yaml` versions with no high-severity production audit findings.

- [ ] **Step 1: Reproduce the release audit failure**

Run: `npm run audit:release`

Expected: FAIL with two high-severity advisories involving `brace-expansion` and `js-yaml`.

- [ ] **Step 2: Apply npm's compatible remediation**

Run: `npm audit fix`

Expected: npm updates compatible transitive package entries and `package-lock.json`; it must not make semver-major changes.

- [ ] **Step 3: Review the generated dependency diff**

Run: `git diff -- package.json package-lock.json`

Expected: `package.json` has no new remediation changes; `package-lock.json` changes only affected transitive resolutions, integrity hashes, and related lockfile metadata. Preserve the pre-existing script edits already present in `package.json`.

- [ ] **Step 4: Verify the dependency graph and release audit**

Run: `npm ls brace-expansion js-yaml --all`

Expected: the vulnerable versions `brace-expansion@1.1.15`, `brace-expansion@2.1.1`, `brace-expansion@5.0.6`, and `js-yaml@4.2.0` are absent from installed vulnerable paths.

Run: `npm run audit:release`

Expected: PASS with zero high-severity production vulnerabilities.

- [ ] **Step 5: Run the complete verification suite**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: ESLint exits 0 with no errors.

Run: `npm run build`

Expected: Next.js production compilation, TypeScript, static generation, and bundle-budget validation all PASS.

- [ ] **Step 6: Commit the lockfile remediation**

```powershell
git add -- package-lock.json
git commit -m "fix: remediate release dependency advisories"
```
