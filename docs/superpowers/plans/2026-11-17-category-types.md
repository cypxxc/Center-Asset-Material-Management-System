# Category Types Implementation Plan

> **For agentic workers:** Use executing-plans inline, then independent final review.

**Goal:** Separate material and asset category choices while retaining shared management.
**Architecture:** Typed categories with per-type unique names and composite inventory foreign keys; carry type through reference options and filter at consuming boundaries.
**Tech Stack:** Next.js 16, React 19, Drizzle, PostgreSQL 17.
**Spec:** docs/superpowers/specs/2026-11-17-category-types-design.md

## Global Constraints
Preserve uncommitted changes, RBAC, stock, depreciation and audits. No live data mutations.

## Review Focus
Shared and archived references survive migration; identical names import into the correct type; forged category IDs fail; bulk mixed types fail atomically; material tab survives saves.

## Tasks
- [x] Add tests for typed category validation, reference filtering and settings tabs.
- [x] Add schema/migration with typed uniqueness and composite foreign keys; verify in an isolated PostgreSQL schema with rollback.
- [x] Carry category types through reference reads; filter forms, explorer and sidebar.
- [x] Add two settings tabs and typed creation/update, preserve redirect context.
- [x] Scope imports and bulk writes by item type; update backup columns and normalize legacy backups.
- [x] Obtain independent review and address timestamp preservation and integration fixture findings. Build and lint completed; full suite blocked by existing React-is-not-defined image-crop tests. User requested stopping further verification.

## Progress
Ruling: implement in the current working tree because substantial user changes are prerequisites for this feature; moving to a clean worktree would omit them. Do not commit unrelated work.

Migration `0013_category_types.sql` is registered in the Drizzle journal with its snapshot. Applied using `npm run db:migrate` after the user reported the missing-column runtime error. Confirmed the target was the local application database, previous migrations were current through 0012, and the category type column exists after migration. No additional test suite runs.

Review fixes: preserve original category/material timestamps and material metadata versions during reference remapping by temporarily disabling only stamp/version triggers under the migration's exclusive locks. Audit triggers remain enabled. Updated asset-category seed/import conflict targets and material staging fixtures for the new typed uniqueness.
