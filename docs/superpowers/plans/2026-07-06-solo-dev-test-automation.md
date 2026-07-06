# Solo Dev Test Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a practical automated test gate for a solo developer so core checks and browser smoke tests can run with simple commands.

**Architecture:** Keep the existing Node test runner for unit/component/integration coverage, and add npm scripts that compose existing checks into clear daily workflows. Harden Playwright by letting it start the Next.js dev server automatically and splitting fast smoke coverage from heavier real Supabase E2E flows.

**Tech Stack:** Next.js 16, Node native test runner, Playwright, axe-core, GitHub Actions, npm scripts.

---

### Task 1: Add Solo Developer Test Commands

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add command aliases**

Add:

```json
"check": "npm run verify-env && npm test && npm run lint && npm run build",
"test:smoke": "playwright test --project=smoke",
"test:e2e": "playwright test --project=chromium",
"test:all": "npm run check && npm run test:smoke"
```

- [x] **Step 2: Verify package script syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package ok')"`

Expected: `package ok`

### Task 2: Harden Playwright Startup

**Files:**
- Modify: `playwright.config.ts`

- [x] **Step 1: Add webServer**

Configure Playwright to start `npm run dev` on port `3000`, reusing an existing server outside CI.

- [x] **Step 2: Add smoke project**

Add a `smoke` project with `testMatch: /.*\.smoke\.test\.ts/` and keep the existing `chromium` project for full E2E files.

- [x] **Step 3: Verify config loads**

Run: `npx playwright test --list`

Expected: Playwright lists smoke/e2e tests without syntax errors.

### Task 3: Add Fast Browser Smoke Coverage

**Files:**
- Create: `tests/e2e/solo-smoke.smoke.test.ts`

- [x] **Step 1: Write smoke tests**

Cover these fast browser checks:

```ts
test('redirects unauthenticated dashboard requests to login', ...)
test('new item dialog uses standard centered layout and persists draft locally', ...)
```

The draft smoke test should use `/login` as the entry page and exercise the actual `/items?new=true` route only when `CAMMS_E2E_REAL_AUTH=true` is set, and otherwise skip with a clear message.

- [x] **Step 2: Run smoke tests**

Run: `npm run test:smoke`

Expected: Unauthenticated redirect passes. Real-data draft flow runs only when `CAMMS_E2E_REAL_AUTH=true`.

### Task 4: Repair Existing Critical E2E Selector Quality

**Files:**
- Modify: `tests/e2e/critical-journey.test.ts`

- [x] **Step 1: Replace mojibake Thai strings**

Use readable Thai text and role-based selectors where possible.

- [x] **Step 2: Keep real Supabase dependency explicit**

Skip full create/edit/delete E2E unless `CAMMS_E2E_REAL_AUTH=true` is explicitly set.

- [x] **Step 3: Verify E2E list**

Run: `npx playwright test --list`

Expected: Tests are discoverable under the intended projects.

### Task 5: Verify Automation Gate

**Files:**
- No source changes unless verification exposes a defect.

- [x] **Step 1: Run fast static/test gate**

Run: `npm run check`

Expected: verify-env, tests, lint, and build pass. Existing JS bundle warning can remain non-failing.

- [x] **Step 2: Run browser smoke gate**

Run: `npm run test:smoke`

Expected: Smoke tests pass or skip only real Supabase-only cases with clear messaging.
