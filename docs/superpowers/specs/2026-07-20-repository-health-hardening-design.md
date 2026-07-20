# Repository Health Hardening Design

## Goal

Improve release consistency and prevent known repository-health regressions without changing deployed database history or weakening existing quality gates.

## Scope

The work covers four focused areas:

1. Pin the supported Node.js and npm toolchain in `package.json` so local development and CI use the same runtime family.
2. Recover safe headroom beneath the existing initial JavaScript bundle limits by measuring the current build output and deferring code that is not required for the initial route.
3. Treat Playwright output as generated data by ignoring `test-results/` and removing the currently tracked result file from version control.
4. Prevent new migration-number collisions while preserving the two historical `00018` migrations exactly as committed and potentially deployed.

Authenticated staging E2E and live database-readiness checks remain explicit release gates. This work will not run migrations, mutate a remote database, access production, or alter secret values.

## Design

### Toolchain consistency

Add `engines.node` for the Node 20 runtime used by CI and a `packageManager` entry matching the repository lockfile. CI remains the enforcement baseline. Documentation will state the supported runtime so developers receive an early warning when using a different major version.

### Bundle headroom

Use production build artifacts to identify initial-route JavaScript contributors. Optimize only code that is not needed for first render, using the repository's existing Next.js 16 patterns and its bundled documentation. Keep the current gzip and raw limits unchanged; increasing the limits is not an optimization. The change is successful when the production build passes and raw initial JavaScript has materially more than the current 3.93 KB margin without harming route behavior.

### Generated test artifacts

Add `/test-results/` to `.gitignore` and remove `test-results/.last-run.json` from Git tracking. Local files may remain on disk, but future test runs must not dirty the repository. No user-authored fixtures or snapshots are included in this rule.

### Migration collision prevention

Historical files `00018_allow_staff_manage_metadata.sql` and `00018_import_items_bulk_tx_line_errors.sql` remain unchanged because renaming applied migrations can desynchronize migration ledgers across environments.

The migration selection utility will validate identifiers for newly introduced migrations while recognizing the existing `00018` pair as an explicit legacy exception. Tests will prove that:

- the historical pair remains selectable in deterministic filename order;
- a new duplicate migration number is rejected;
- unknown or out-of-order selections continue to fail;
- no migration is executed during validation tests.

The exception will be documented near the validation logic and in deployment guidance so it cannot silently expand to later collisions.

## Error handling and safety

Validation failures will report the conflicting migration number and filenames. Toolchain mismatch messages should identify the supported Node major. Bundle-budget failures retain their current measured-versus-limit output.

All edits must preserve unrelated uncommitted work. No destructive Git operation, migration execution, production connection, or secret modification is authorized by this design.

## Verification

Implementation will follow test-driven development for validation behavior. Final verification consists of:

1. targeted unit tests for migration selection, bundle accounting, and release contracts;
2. `npm run check` for environment validation, the full test suite, lint, TypeScript, and production build;
3. `npm run audit:release` for high-severity production dependency findings;
4. a clean comparison of Git status before and after a representative test run to confirm Playwright artifacts are ignored.

Authenticated staging E2E and `verify-db-release` will be documented as operator-run release evidence because they require protected staging credentials and a known target database.

## Success criteria

- Local and CI runtime expectations are explicit and aligned on Node 20.
- Initial bundle budgets still pass with meaningful raw-size headroom.
- Playwright result files no longer appear as tracked or untracked changes.
- Existing `00018` migration history remains compatible.
- Future unapproved migration-number collisions fail deterministically before database execution.
- Full repository checks and the production dependency audit pass.
