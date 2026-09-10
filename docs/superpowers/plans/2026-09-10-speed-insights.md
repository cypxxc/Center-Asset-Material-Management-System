# Speed Insights Implementation Plan

**Goal:** Remove demonstrated initial-load waste and review all approved performance areas.

**Architecture:** Keep authorization and cached server data unchanged unless measurements justify a change. Import the creation sheet on user demand and retain its component after loading; reuse existing toast error feedback. Replace the sole Material Symbols icon with Lucide.

**Tech Stack:** Next.js, React, TypeScript, node:test.

**Spec:** docs/superpowers/specs/2026-09-10-speed-insights-design.md

## Constraints
No database operations, new dependencies, auth weakening or unmeasured score claims.

## Tasks
- [x] Record baseline build budgets before edits.
- [x] In new-item-dialog-provider.tsx replace the eager import with a type-only import and on-demand `import('./new-item-sheet')`. Cache the loaded component in state, guard concurrent loads with a ref, show a status during loading and an error toast on failure. Preserve mounting after first use and existing callbacks.
- [x] Extend tests/component/new-item-dialog-provider.test.tsx to assert no form before opening, asynchronous opening, close/reopen and compatibility URL behavior.
- [x] Remove the Google Fonts import in app/globals.css; replace the settings error span with `CircleAlert` from lucide-react.
- [x] Review layout/query sequencing, images, chart and skeleton sizing; document observed constraints and unproven hypotheses.
- [x] Run focused tests, full tests, lint, typecheck and production build. Record comparable asset deltas and remaining field-measurement limitations.
