# Dead-Code Audit Design

## Objective

Create an evidence-backed, repository-wide dead-code audit and a safe removal plan for CAMMS Portal. The audit covers application code, tests, scripts, configuration, dependencies, database migrations, and seed data.

## Scope

- `app/`, `components/`, `features/`, `hooks/`, and `lib/`
- Root configuration and delivery files, including `package.json`, Next.js configuration, ESLint, TypeScript, Playwright, and CI workflows
- `scripts/`, `tests/`, and test setup/mocks
- `db/migrations/` and `db/seed.sql`
- Runtime and development dependencies

Excluded paths remain `node_modules/`, `prototype/`, and `.agent/`.

## Audit Strategy

Use a layered analysis so no single static signal is treated as proof:

1. Map TypeScript/JavaScript imports, exports, and compiler-reported unused symbols.
2. Check Next.js convention-based entry points, route handlers, proxy/instrumentation files, dynamic imports, and string-based references.
3. Cross-reference scripts, CI workflows, test discovery, configuration, environment verification, and package scripts.
4. Trace database-facing references: migrations, SQL/RPC calls, seed data, and schema assumptions in application queries/actions.
5. Inspect each candidate using repository-wide search and classify it by confidence and risk.

## Candidate Classification

| Classification | Meaning | Action |
| --- | --- | --- |
| Safe removal | No live entry point, reference, convention-based use, or delivery dependency exists. | Include in the ordered removal batch. |
| Needs confirmation | Static references are absent, but dynamic, operational, or external use is plausible. | Preserve and document the question/evidence needed. |
| Historical/immutable | Already-deployed migration or audit-relevant artifact is obsolete but must remain for reproducible history. | Do not delete; recommend a forward-only migration only if a database change is required. |
| Active | Has a verified runtime, build, test, CI, or database dependency. | Keep; exclude from removal work. |

## Deliverable

Produce a report with, for every candidate:

- path and symbol/package name;
- evidence collected and likely consumer/absence of consumers;
- classification and risk level;
- recommended action and dependencies between removals.

The report ends with an ordered implementation plan. Each planned deletion includes the validation commands needed after that batch: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`, with focused checks where appropriate.

## Safety Rules

- Do not delete or rewrite previously applied database migrations. Duplicate migration numbering, superseded SQL, and unused schema paths are audit findings, not deletion targets.
- Treat Next.js file conventions, dynamic imports, environment-driven references, CLI entry points, and CI-only files as live until disproven.
- Do not remove a dependency only because source imports are absent; first verify package scripts, config plugins, generated output, and toolchain use.
- Do not modify application code in the audit phase. The resulting removal plan must be approved before cleanup begins.

## Errors and Validation

Missing source evidence results in `Needs confirmation`, not `Safe removal`. If static analysis conflicts with a documented or convention-based execution path, retain the artifact and record the conflict. The implementation phase validates each batch independently and stops before proceeding if a quality gate fails.

## Success Criteria

- Every scoped area is inspected.
- Every removal recommendation is evidence-backed and classified.
- No deployed migration is removed or rewritten.
- The cleanup plan is ordered, reversible through version control, and has explicit validation gates.
