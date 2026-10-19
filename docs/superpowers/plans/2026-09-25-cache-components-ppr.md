# Next.js 16 Cache Components (Partial Prerendering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enable Next.js 16 Partial Prerendering (PPR) via `cacheComponents: true` in `next.config.ts`, ensuring all routes either prerender an instant static shell or adopt incremental opt-out (`export const instant = false`) according to official Next.js 16 documentation, passing all test and build gates.

**Architecture:**
1. In Next.js 16, experimental PPR (`experimental.ppr`) is replaced by top-level `cacheComponents: true`.
2. Enable `cacheComponents: true` in `next.config.ts`.
3. For dynamic routes that perform runtime authentication checks or database queries at request time without `"use cache"`, set `export const instant = false` as recommended by the Next.js 16 incremental adoption guide, allowing instant navigation validation to pass while preserving static shell prerendering for static routes.
4. Verify complete build (`next build`), typecheck, tests (`npm test`), and bundle budget.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, node:test runner.

## Global Constraints
- Do not remove or bypass Supabase authentication, RLS, or role-based security.
- Preserve all existing tests and passing test suite: `npm test`.
- Pass bundle budget checks (`scripts/check-bundle-budget.ts`).

---

### Task 1: Enable `cacheComponents: true` in `next.config.ts`

**Files:**
- Modify: `next.config.ts`

- [x] **Step 1: Update `next.config.ts`**
Add `cacheComponents: true` to `nextConfig`.

- [x] **Step 2: Run typecheck and check compiler diagnostics**
Run: `npm run typecheck`

- [x] **Step 3: Run build to observe route validation**
Run: `npm run build`

---

### Task 2: Handle Incremental Route Validation

**Files:**
- Modify: Affected routes in `app/(dashboard)/**` or `app/(auth)/**` as indicated by Next.js 16 build compiler diagnostics.

- [x] **Step 1: Apply `export const instant = false` or Suspense boundaries as required by Next 16 Cache Components validator**
- [x] **Step 2: Verify `npm run build` passes with bundle budgets within limits**

---

### Task 3: Full Quality Gate Verification

- [x] **Step 1: Run `npm run typecheck`**
- [x] **Step 2: Run `npm test`**
- [x] **Step 3: Run `npm run lint`**
- [x] **Step 4: Run `npm run build`**
