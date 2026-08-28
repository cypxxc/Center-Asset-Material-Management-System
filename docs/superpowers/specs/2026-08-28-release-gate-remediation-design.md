# Release Gate Remediation Design

## Goal

Restore a passing release pipeline without increasing the approved Dashboard JavaScript budgets. Remove the obsolete Header user-guide feature, align creation-audit tests with the depreciation data model, and reduce Dashboard initial client code while preserving current data, permissions, and user-facing behavior.

## Scope

- Remove the unused Header guide dialog and its obsolete lazy-loading expectation.
- Update item-creation audit expectations to include the stable depreciation default fields.
- Keep Dashboard server-rendered data and Suspense fallbacks intact.
- Move Dashboard realtime refresh into a non-blocking client boundary that loads after the initial page render and refreshes once when it becomes active.
- Keep Dashboard budgets at 160 KB raw and 50 KB gzip.

## Non-Goals

- Do not change the Supabase schema, migrations, RLS, roles, or CRUD behavior.
- Do not raise performance budgets.
- Do not remove Dashboard metrics, charts, low-stock information, or realtime refresh behavior.

## Architecture

### Obsolete guide removal

`components/layout/header-guide-dialog.tsx` will be deleted. `components/layout/header.tsx` will retain no guide state, trigger, or dynamic import. The guide-specific unit assertion will be removed or replaced so tests validate the intended absence rather than an abandoned interface.

### Audit-payload contract

The `createItem` and inline creation paths already emit `depreciation_enabled`, `depreciation_cost`, `depreciation_useful_life_years`, `depreciation_start_basis`, and `depreciation_start_date`. The shared integration-test expectation will include their default values, ensuring both write paths preserve the same complete audit schema.

### Dashboard loading

The Dashboard remains server-rendered: stat cards, category content, low-stock content, and their Suspense fallbacks continue to fetch and render on the server. The realtime subscription becomes a separately loaded client enhancement. On activation it performs a refresh before listening for subsequent subscribed-table changes, avoiding a stale window between SSR and subscription setup. A subscription or refresh failure remains isolated from page rendering.

### Performance verification

The bundle-budget analyzer remains authoritative and keeps the current limits. The implementation will inspect the Dashboard client-reference manifest after each build. If extracting realtime code alone is insufficient, the next largest nonessential interactive Dashboard dependency will be split using the same manifest-led approach; server output and core Dashboard content remain unchanged.

## Testing

- Update targeted `create-item` integration tests for the complete depreciation-aware audit payload.
- Replace the obsolete Header guide test with a regression assertion that no Header guide import/reference remains.
- Retain and run the budget analyzer test against a production build.
- Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:smoke`.

## Acceptance Criteria

- All tests pass, including item creation and bundle-budget tests.
- ESLint passes.
- Production build passes with Dashboard route JavaScript at or below 160 KB raw and 50 KB gzip.
- Browser smoke tests pass.
- The Header has no user-guide UI or guide dependency.
- Dashboard initial render works without waiting for realtime setup, and realtime refresh still operates after its boundary activates.
