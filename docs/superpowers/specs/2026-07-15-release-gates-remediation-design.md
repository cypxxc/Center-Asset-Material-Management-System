# Release Gates Remediation Design

## Goal

Make the current Registry-S release candidate objectively releasable through repeatable local and CI checks, without deploying or mutating staging/production as part of the code change.

## Scope

The remediation covers the identified release blockers and warnings:

- Playwright processes must terminate reliably and report a real exit status.
- CI must enforce environment validation, dependency audit, tests, lint, production build, and browser smoke coverage.
- Authenticated critical journeys must be an explicit staging/release gate and must never be silently treated as covered when credentials are absent.
- Database readiness must be verifiable with read-only checks for required migrations, RLS, and privileged function grants.
- Migration execution must be explicit, auditable, and safe to rerun only where migrations are idempotent.
- Privileged Supabase functions must perform authorization internally and expose only the minimum required execute grants.
- The initial JavaScript budget must retain practical headroom instead of barely passing.
- Release documentation must describe the exact automated and manual gates.

Production deployment, applying migrations to remote databases, committing application changes, and pushing are outside this implementation's automatic actions.

## Approach

### Browser verification

Use a production-style Playwright server command for deterministic lifecycle management rather than relying on the long-running development server. Keep an unauthenticated smoke suite that always runs. Keep the database-mutating admin journey behind `CAMMS_E2E_REAL_AUTH=true`, but add a release command that fails fast when the flag or required credentials are absent so CI cannot claim authenticated coverage accidentally.

The critical journey will clean up data it creates where the product supports cleanup. Test configuration and command-level regression tests will verify that the selected command terminates and that release mode enforces prerequisites.

### CI gates

CI will call named npm scripts rather than duplicate an incomplete sequence. The standard CI job will run the deterministic non-mutating checks and browser smoke suite. A separately configurable authenticated release job or command will require real staging credentials and seeded role accounts. Lint will be explicit in the enforced chain.

### Database readiness

Add a read-only release readiness checker using the service-role server environment. It will inspect:

- required migration identifiers recorded in an application-owned migration ledger;
- RLS enabled state for exposed registry tables;
- execute ACLs for raw SQL, reports, bulk import, and database restore functions;
- required internal authorization behavior represented by the deployed function definitions where feasible.

The checker will return non-zero for missing or unsafe state and will not print secrets. Migration files will create/update the ledger as part of their transaction. The migration runner will use the service-role path directly, reject unknown or unordered file lists, and avoid creating temporary Auth users.

### Security boundaries

`exec_admin_sql` remains service-role-only. Reporting RPCs may be executable by authenticated users because they serve normal application reads, but must reject inactive or missing profiles internally before using `SECURITY DEFINER`. Bulk import must enforce admin/staff internally. Database restore must enforce admin internally. `PUBLIC` and `anon` execute access will be revoked explicitly for all privileged RPCs.

Authorization remains duplicated at the server-action boundary and inside privileged database functions; client checks are never authoritative.

### Bundle headroom

Use build output and import tracing to identify the largest root-client dependency. Move route-specific or infrequently used code behind existing route/client boundaries or dynamic imports. No arbitrary budget increase is allowed. Success requires measurable reduction and no user-visible behavior regression.

## Error handling

- Release scripts fail with concise, actionable messages and non-zero exit codes.
- Missing staging credentials are reported as a failed authenticated release prerequisite, not a skipped success.
- Database checks identify the exact missing migration, unsafe grant, or RLS table.
- Migration execution stops on the first failed statement and records a migration only after all statements in that file succeed.
- Cleanup failures in E2E are reported without hiding the original test failure.

## Testing strategy

Changes follow red-green-refactor where practical:

1. Add focused tests for Playwright/release configuration and prerequisite enforcement.
2. Add tests for migration list ordering, ledger behavior, and SQL statement splitting.
3. Add static migration tests asserting required revokes and internal authorization checks.
4. Run unit/component/integration tests, lint, production build, dependency audit, and browser smoke.
5. Run the authenticated release command only when staging credentials are available; otherwise report it as an external release prerequisite, never as passed.

## Release acceptance criteria

- Worktree changes intended for release are identifiable and `git diff --check` is clean.
- `npm run check`, `npm run audit:release`, and browser smoke complete with exit code 0.
- Playwright terminates without timeout.
- CI contains an explicit lint gate and cannot silently count a skipped authenticated journey as release coverage.
- Database readiness checker passes against the target environment after required migrations are applied.
- Required staging role and CRUD/restore/backup journeys pass.
- Initial root JavaScript has meaningful headroom below the 450 KB ceiling.
- Documentation contains the final deploy order and rollback/verification steps.

