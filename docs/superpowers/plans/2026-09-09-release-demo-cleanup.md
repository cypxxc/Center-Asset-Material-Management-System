# Release Demo Cleanup Implementation Plan

**Goal:** Remove repository and UI demonstrations without touching remote data.
**Architecture:** Delete unused fake tools and seed file; keep real MCP and test fixtures. Fail image processing explicitly and require configured E2E credentials.
**Tech Stack:** Next.js, React, TypeScript, Node test runner, Playwright.
**Spec:** ../specs/2026-09-09-release-demo-cleanup-design.md

## Constraints
No remote database reads or writes. Preserve old import-template filtering and real print previews.

## Tasks
- [x] Add image crop regression tests for missing encoder, null/empty encoding, image load error and valid JPEG fallback. Run `node --import tsx --test tests/component/image-crop-dialog.test.tsx` and confirm failures before implementation.
- [x] Replace empty-file success paths with visible error state; reset error on retry/image change and select filename extension from actual blob MIME type. Re-run crop tests.
- [x] Remove db/seed.sql and unused lib/tool-pipeline/tools/items.ts plus its demo-specific tests after reference inspection.
- [x] Remove Excel example rows and CSV example column in features/settings/components/metadata-sections.tsx. Preserve column definitions and legacy example filtering.
- [x] Require explicit CAMMS_E2E_ADMIN_ID/PASSWORD in critical-journey and draft smoke login. Remove seed-user wording. Update README setup text.
- [x] Run all tests, typecheck, lint, audit, production build and unauthenticated smoke. Inspect diff and remaining demo matches. Record staging E2E as unverified, then commit the cleanup.
