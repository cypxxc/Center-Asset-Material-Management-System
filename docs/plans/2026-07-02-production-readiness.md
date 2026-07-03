# CAMMS Onboarding & Production Readiness Guide

Welcome to Registry-S (Center Asset & Material Management System) Sprint 5 testing and monitoring setup. This document outlines onboarding guidelines, folder conventions, testing architectures, and centralized logging rules.

---

## 1. Directory Tree & Architecture Overview

The codebase is structured around a Next.js App Router + bounded feature module strategy:

```
app/                        Next.js routing layouts (Auth, Dashboard)
features/                   Feature boundaries (items, reports, settings, admin, auth)
  <feature>/                Bounded context (actions.ts, queries.ts, components/, types.ts, schema.ts)
lib/                        Shared primitives, supabase server/middleware clients, permissions
components/layout/          Header, sidebar structure
components/ui/              Tailwind v4 styled shadcn components
tests/                      Central test directory
  unit/                     Unit tests for schemas, normalization and permissions helpers
  component/                JSDOM mounted RTL components (e.g. Button, Toast, ConfirmDialog)
  integration/              Action workflow tests using mock Supabase
  e2e/                      Playwright browser tests + Axe accessibility audits
  mocks/                    Dynamic mock client registry for Supabase queries
  setup/                    Manual DOM environment initialization
```

- **Server-Only Isolation:** Read queries (`queries.ts`) must never import from mutations (`actions.ts`) to avoid circular imports.
- **Supabase Clients:** Prefer anon-key clients (`createClient`) to respect Postgres RLS. Use `createAdminClient` or service-role clients exclusively for system operations.

---

## 2. Developer Onboarding & Running Tests

### Running Test Coverage
We leverage Node's native test runner. To execute tests and run coverage analysis:
```bash
# Run unit, component and integration tests
npm test

# Run tests and generate native ASCII coverage table
npm run test:coverage
```

### Running E2E & Accessibility Tests
E2E browser tests run on Playwright Chromium and perform automatic Axe WCAG 2.1 AA accessibility checks:
```bash
# Start local Next.js dev server on port 3000
npm run dev

# Launch E2E test suite (in another terminal)
npx playwright test
```
*Note: In CI/CD pipelines, E2E tests are gracefully skipped if real Supabase environment variables are missing (falling back to placeholder values).*

---

## 3. Central Logging & PII Sanitizer

Central structured logging outputs raw JSON formats to standard console streams.
- **Log Levels:** `logger.info`, `logger.warn`, `logger.error`
- **PII Scrubbing:** The logging engine automatically scrubs the following credentials, secrets and keys:
  - Object keys matching `password`, `secret`, `token`, `key`, `credential`, `authorization`, `cookie`, `session`.
  - Inline JWT tokens (e.g., Bearer authorization headers).
  - Supabase database access keys.
