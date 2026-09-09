# Security Hardening Implementation Plan

> Execute using subagent-driven-development for independent auth work and inline implementation for the limiter, followed by independent review.

**Goal:** Remove development auth bypasses and enforce shared, fail-closed request limits.
**Architecture:** Supabase Auth identities; service-role-only PostgreSQL limiter RPC; explicit ingress trust; server-side admin gates.
**Tech Stack:** Next.js 16, TypeScript, PostgreSQL, node:test.
**Spec:** ../specs/2026-09-09-security-hardening-design.md

## Global constraints
Preserve restore user session. No remote schema writes. No memory request fallback. No unrelated UI refactoring.

## Tasks
- [ ] Auth: reproduce forged cookie and cross-request identity acceptance in tests; remove dev-auth imports and fallback from features/auth/actions.ts, queries.ts, lib/supabase/middleware.ts; retain regression tests verifying Supabase identity. Rename createAdminClient globally and protect server factory; adjust test setup for server-only modules.
- [ ] Limits: update tests expecting outside-request success to expect rejection (`assert.equal(result.success, false)`). Add IP parsing and PostgreSQL adapter tests. Implement shared fixed-window RPC with atomic upsert, service-role grants, RLS, bounded expiry cleanup, and strict response validation. Keep memory implementation only as an explicitly constructed test helper.
- [ ] Coverage: inspect every server mutation/export/restore entry point. Add per-action guards after authorization and before side effects. For login, use IP independently of session. Add admin SQL confirmation and audit-before-execute tests. Make revalidation secret comparison timing-safe.
- [ ] Verify: run focused tests, SQL concurrency/grant checks in disposable database, full test suite, typecheck, lint and build. Fix regressions; review final diff independently; document deployment prerequisites and actual verification limits.

## Validation commands
```powershell
node --import tsx --test lib/rate-limit.test.ts tests/unit/rate-limit.test.ts
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

## Progress ledger
Design approved; inspected current auth/rate-limit/admin code. Docker daemon unavailable; use an isolated embedded PostgreSQL test runtime if needed. No external database modified.
