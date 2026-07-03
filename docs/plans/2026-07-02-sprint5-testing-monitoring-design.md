# Sprint 5 — Testing, Monitoring & CI/CD Hardening Design Document

**Date:** 2026-07-02  
**Sprint:** Sprint 5  
**Objective:** Enhance reliability, test coverage, observability, and deployment safety of the Center Asset & Material Management System (CAMMS) without introducing new business features.

---

## 1. Architectural Decisions & System Design

### 1.1. Testing Setup & JSDOM Manual Configuration (Phases 4 & 5)
To maintain the existing Node.js native test runner (`tsx --test`), we will manually configure a lightweight browser environment (`JSDOM`) and React Testing Library.

*   **Setup Helper (`lib/test-env-setup.ts`):** Creates global browser environment mocks (`window`, `document`, `navigator`, `requestAnimationFrame`, etc.) in Node.
*   **Test Integration:** Every component and integration test imports `lib/test-env-setup` at the top of the file to ensure the DOM environment is initialized before React and testing utilities load.

### 1.2. Server Action & Database Mocking Strategy (Phases 3 & 5)
Server Actions and queries must be tested in isolation from the production database.

*   **Testing Bypass (`lib/supabase/server.ts`):** If `process.env.NODE_ENV === 'test'` or `process.env.MOCK_SUPABASE === 'true'`, the client creators will bypass the real `@supabase/ssr` creation and return a local mock client.
*   **Mock Client & Registry (`lib/supabase/mock-client.ts`):** Implements a chainable query builder supporting standard CRUD/select operations (`.select()`, `.insert()`, `.update()`, etc.).
*   **Test-Controlled Mocking:** A global `mockSupabaseRegistry` object exposes helpers like `.setTableResponse(table, data, error)` and `.setAuth(user, profile)`. This allows individual test cases to register custom data responses before executing Server Actions/Queries.

### 1.3. Playwright E2E & accessibility (axe-core) Integration (Phases 6 & 7)
Playwright E2E tests verify user journeys and automatically perform accessibility audits.

*   **E2E Test Server Mode:** Next.js starts with `MOCK_SUPABASE=true` during Playwright runs. This isolates E2E testing from real database connections, ensuring E2E runs are 100% deterministic and do not require Docker containers.
*   **Playwright Config (`playwright.config.ts`):** Automatically boots the Next.js dev server with `MOCK_SUPABASE=true` on port `3000` via its `webServer` block.
*   **Axe Accessibility Checks:** Incorporates `@axe-core/playwright` (`AxeBuilder`) directly inside user journey specs to audit the Login page, Dashboard, and Items explorer for WCAG AA compliance.

### 1.4. Centralized Logging & Error Formatting (Phase 9)
Extends the current structured logger (`lib/logging/logger.ts`) to output JSON formatted logs while guarding user privacy.

*   **PII & Secrets Sanitizer:** Integrates a recursive object key sanitizer. Keys matching patterns like `password`, `token`, `key`, `secret`, `cookie`, `auth`, `credential`, and `email` are replaced with `[REDACTED]`.
*   **Trace & Environment Enrichment:** Logs automatically include `environment` (e.g. `production`, `development`, `test`), `traceId` (for request tracing), and caught `Error` stacks.
*   **Audit Logger (`logger.audit`):** Standardizes tracking of administrative actions (inserts, updates, deletes) in a format suitable for standard log ingestion.

---

## 2. Approach Selection

*   **Selected Approach:** Approach 1 - Phase-by-Phase Direct Integration.
*   **Rationale:** Maintains strict compatibility with the Node native test runner while utilizing Playwright for high-fidelity E2E user journeys and automated accessibility audits.

---

## 3. Verification Plan

Verification will be run incrementally after completing each implementation phase:
```bash
npm test
npm run lint
npm run build
```
Playwright E2E and axe-core tests will be run via:
```bash
npx playwright test
```
