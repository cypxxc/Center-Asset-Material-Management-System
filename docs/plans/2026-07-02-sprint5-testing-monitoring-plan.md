# Sprint 5 — Testing, Monitoring & CI/CD Hardening Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Establish 90%+ coverage for pure functions, test critical server actions, reusable UI components, and key workflows under a manual JSDOM environment, automate E2E/accessibility checks via Playwright + axe-core, harden CI/CD, and introduce centralized structured error logging.

**Architecture:** Manually configure JSDOM for Node's test runner, mock Supabase dynamically via a mock client registry, start Next.js with `MOCK_SUPABASE=true` for isolated Playwright E2E runs, output sanitized structured JSON logs, and enforce build/test checks in CI.

**Tech Stack:** Next.js 16 (React 19), Node.js native test runner (`tsx --test`), JSDOM, React Testing Library, Playwright, `@axe-core/playwright`, Zod, `@tailwindcss/postcss`.

---

### Task 1: Testing Environment, JSDOM & RTL Setup

**Files:**
- Modify: `package.json`
- Create: `lib/test-env-setup.ts`

**Step 1: Install JSDOM and Testing Library dependencies**
- Install `jsdom`, `@types/jsdom`, `@testing-library/react`, `@testing-library/dom` as devDependencies.
- Command: `npm install -D jsdom @types/jsdom @testing-library/react @testing-library/dom`

**Step 2: Create the JSDOM environment helper**
- Write `lib/test-env-setup.ts` to mock `window`, `document`, `navigator`, and layout timers:
```typescript
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;

global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
```

**Step 3: Run existing tests to verify setup does not break them**
- Run: `npm test`
- Expected: All 17 baseline tests pass.

**Step 4: Commit**
- Command: `git add package.json package-lock.json lib/test-env-setup.ts && git commit -m "test: configure manual jsdom setup for node test runner"`

---

### Task 2: Unit Testing (Schemas, Utilities, Permissions)

**Files:**
- Create: `lib/permissions.test.ts`
- Create: `lib/logging/logger.test.ts`
- Modify: `features/items/schema.test.ts`

**Step 1: Write permission helper tests**
- Write `lib/permissions.test.ts` using `node:test` and `node:assert`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, isStaff, isViewer, canWrite, canDelete } from './permissions';

test('permissions identify correct roles', () => {
  assert.equal(isAdmin('admin'), true);
  assert.equal(isAdmin('staff'), false);
  assert.equal(isStaff('staff'), true);
  assert.equal(isViewer('viewer'), true);
  assert.equal(canWrite('staff'), true);
  assert.equal(canWrite('viewer'), false);
  assert.equal(canDelete('admin'), true);
  assert.equal(canDelete('staff'), false);
});
```

**Step 2: Run permissions tests**
- Run: `npm test`
- Expected: PASS

**Step 3: Write logger sanitization unit tests**
- Write `lib/logging/logger.test.ts` to verify structured formatting and key sanitization.

**Step 4: Commit**
- Command: `git commit -am "test: add permissions and logger unit tests"`

---

### Task 3: Supabase Mock Client & Server Action Testing

**Files:**
- Create: `lib/supabase/mock-client.ts`
- Modify: `lib/supabase/server.ts`
- Create: `features/items/actions.test.ts`
- Create: `features/settings/actions.test.ts`

**Step 1: Write Mock Client and Mock Registry**
- Write `lib/supabase/mock-client.ts` as approved in Design Section 2.

**Step 2: Add test bypass in Supabase client creator**
- Modify `lib/supabase/server.ts` to return mock client if `process.env.NODE_ENV === 'test'` or `process.env.MOCK_SUPABASE === 'true'`.

**Step 3: Write test for createItem Server Action**
- Create `features/items/actions.test.ts` to import `createItem` action, set mock database/auth responses in registry, invoke action, and assert validation and database error handling.

**Step 4: Verify tests pass**
- Run: `npm test`
- Expected: PASS

**Step 5: Commit**
- Command: `git add lib/supabase/mock-client.ts lib/supabase/server.ts features/items/actions.test.ts && git commit -m "test: mock database and write server action tests"`

---

### Task 4: UI Component Testing (Button, StatusBadge, EmptyState)

**Files:**
- Create: `components/ui/button.test.tsx`
- Create: `components/ui/status-badge.test.tsx`
- Create: `components/ui/empty-state.test.tsx`

**Step 1: Write Button component test**
- Create `components/ui/button.test.tsx` importing `./test-env-setup` at the top:
```typescript
import '../../lib/test-env-setup';
import test from 'node:test';
import assert from 'node:assert/strict';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from './button';

test('Button renders text and triggers onClick', () => {
  let clicked = false;
  render(React.createElement(Button, { onClick: () => { clicked = true; } }, 'Click Me'));
  const btn = screen.getByText('Click Me');
  assert.ok(btn);
  btn.click();
  assert.equal(clicked, true);
});
```

**Step 2: Run component tests**
- Run: `npm test`
- Expected: PASS

**Step 3: Commit**
- Command: `git add components/ui/*.test.tsx && git commit -m "test: add button and ui component tests"`

---

### Task 5: Workflow Integration Testing

**Files:**
- Create: `features/items/integration.test.tsx`

**Step 1: Write Item creation integration test**
- Create `features/items/integration.test.tsx` to mount the main item form under JSDOM environment, fill fields, submit form using mock action handler, and assert success toasts.

**Step 2: Verify integration test passes**
- Run: `npm test`
- Expected: PASS

**Step 3: Commit**
- Command: `git commit -am "test: add item creation workflow integration tests"`

---

### Task 6: Playwright E2E & Axe Accessibility Automation

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/critical-journeys.spec.ts`

**Step 1: Install Playwright & Axe dependencies**
- Command: `npm install -D @playwright/test @axe-core/playwright cross-env`

**Step 2: Create `playwright.config.ts`**
- Configure playwright directory, viewport, and `webServer` block setting `MOCK_SUPABASE=true`.

**Step 3: Write E2E spec in `e2e/critical-journeys.spec.ts`**
- Implement login flow, navigation flow, and run accessibility checks using `AxeBuilder`.

**Step 4: Run E2E tests**
- Command: `npx playwright test`
- Expected: All E2E tests pass with zero accessibility violations.

**Step 5: Commit**
- Command: `git add playwright.config.ts e2e/ && git commit -m "test: introduce playwright e2e tests and axe accessibility audits"`

---

### Task 7: Performance Monitoring & Recommendation Report

**Files:**
- Create: `docs/plans/2026-07-02-performance-report.md`

**Step 1: Analyze bundle sizes**
- Run: `npm run build`
- Examine page sizes and output chunks.

**Step 2: Write Performance Report**
- Document LCP, CLS, hydration status, large client components, bundle size optimization recommendations.

**Step 3: Commit**
- Command: `git add docs/plans/2026-07-02-performance-report.md && git commit -m "docs: add performance analysis report"`

---

### Task 8: central Structured Logging & Sanitizer Implementation

**Files:**
- Modify: `lib/logging/logger.ts`
- Modify: `lib/logging/formatter.ts`

**Step 1: Implement PII sanitizer and trace/env enrichment**
- Modify `lib/logging/formatter.ts` to recursively scan fields and replace credentials/PII keys with `[REDACTED]`. Add `process.env.NODE_ENV` as `environment`.
- Add `audit` method to `logger.ts`.

**Step 2: Run logger tests**
- Run: `npm test`
- Expected: PASS

**Step 3: Commit**
- Command: `git commit -am "feat: implement JSON formatted structured logging with key sanitization"`

---

### Task 9: CI/CD Hardening

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Update CI/CD workflow**
- Edit `.github/workflows/ci.yml` to run playwright tests:
```yaml
      - name: Run Playwright E2E tests
        run: npx playwright install --with-deps && npx playwright test
```

**Step 2: Verify build and test flow**
- Run: `npm run build` and `npm test` locally.

**Step 3: Commit**
- Command: `git commit -am "ci: integrate playwright e2e tests to github action pipeline"`

---

### Task 10: Dependency Audit & Env Validation

**Files:**
- Modify: `scripts/verify-env.ts`

**Step 1: Check verify-env script**
- Review `scripts/verify-env.ts` to ensure clean environment startup validation.

**Step 2: Run dependency check**
- Run: `npm audit` and recommend any cleanups.

**Step 3: Commit**
- Command: `git commit -am "ci: audit dependencies and verify env helper"`

---

### Task 11: Production Readiness Documentation

**Files:**
- Create: `docs/plans/2026-07-02-production-readiness.md`

**Step 1: Generate comprehensive guides**
- Document the testing guide, onboarding structure, folder conventions, structured log configuration, E2E run guides, and architecture summary.

**Step 2: Commit**
- Command: `git add docs/plans/2026-07-02-production-readiness.md && git commit -m "docs: generate sprint 5 testing and production readiness documentation"`
