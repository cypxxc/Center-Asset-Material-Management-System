# Release Readiness Hardening Design

## Goal

Make the current Registry-S release candidate internally consistent and safe to ship without taking a breaking Next.js upgrade solely to address a transitive PostCSS advisory.

## Decisions

- Keep Next.js 16.2.9 unchanged.
- Pin the vulnerable transitive PostCSS dependency to the patched 8.5.x line through npm overrides.
- Keep the release audit threshold at high/critical so moderate upstream advisories do not block releases; the current advisory should nevertheless disappear after the override.
- Treat migrations 00029 and 00030 as part of the release candidate and keep deployment documentation aligned with them.

## Verification

The release gate must pass environment validation, tests, lint, production build/bundle budget, dependency audit, and unauthenticated browser smoke. Production approval still requires applying and verifying the listed Supabase migrations and running authenticated staging smoke tests with real seeded users.

## Scope

This change does not alter item workflows, role semantics, or production Supabase state. It only hardens dependency resolution and release documentation/packaging around already-authored security migrations.
