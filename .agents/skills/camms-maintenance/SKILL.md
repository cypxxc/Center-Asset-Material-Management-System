---
name: camms-maintenance
description: Investigate and fix CAMMS performance, security, unused code, and regression coverage with evidence and a reviewable change report. Use for CAMMS maintenance requests, including whole-system audits; preserve narrower requested scope.
---

# CAMMS maintenance

Work directly in the CAMMS repository through Codex. This workflow needs no OpenAI API integration in the application. Inspect the current checkout rather than relying on historical audit conclusions.

## Establish scope and baseline

- Read root and applicable nested `AGENTS.md`, `package.json`, and relevant source/tests. Read the installed Next.js documentation before framework edits. Use `docs/cleanup/README.md` as historical context, not current verification.
- Inspect Git status, branch, and existing diffs. Preserve user work. For new maintenance work, create a `codex/` branch; reuse a task branch when appropriate. If isolation is necessary, use a worktree and account for uncommitted changes explicitly. Never reset or stash user work merely to obtain a clean tree.
- Treat an audit-only request as read-only. A request to investigate and fix authorizes scoped reversible code edits. Do not turn cleanup into feature development or dependency replacement.
- Record baseline failures for checks relevant to the request. For a whole-system review, map entry points, authentication, queries, mutations, exports/imports, and operational scripts, then prioritize concrete findings by severity. Keep a short checklist of reviewed and unreviewed areas.

## CAMMS boundaries

- Supabase is the intended primary backend. Verify active configuration without printing secrets. Do not activate local PostgreSQL, require Docker, or remove the supported PostgreSQL backend just because it is inactive.
- Preserve Admin/Staff/Viewer permissions, user-scoped database access, RLS, mutation validation, audit behavior, and atomic bulk updates. Never fix an authorization failure by switching user requests to a service-role client.
- Use isolated fixtures or staging for mutations and authenticated browser tests. Do not apply migrations, seed data, execute backup/restore, run load tests against production, or change deployed settings without authorization covering that action. Inspect a script's target and effects before running it.
- Keep API keys, passwords, cookies, connection strings, and customer records out of logs, reports, and commits. Report missing configuration by variable name only.

## Investigate and make focused fixes

### Performance

Reproduce the reported slow operation. Record the route/action, dataset size, build mode, cache state, and timing method. Separate browser rendering, server work, database queries, and external services. Look for repeated queries, unnecessary payloads, unbounded fetches, expensive exports, and client bundle cost only where evidence points. Compare before/after under equivalent conditions; bundle budgets alone do not establish runtime speed. If access or representative data is unavailable, state what could not be measured instead of claiming an improvement.

### Security

Trace user input through authentication, role checks, validation, database access, and error responses. Review relevant RLS/RPC grants, file handling, injection surfaces, secret boundaries, and dependencies. `npm run audit:security` checks a small set of local controls; it is not a penetration test. `npm run audit:release` checks production dependency advisories. Neither proves the entire system secure. Do not use forced dependency upgrades or weaken assertions to make a gate pass.

### Cleanup

Before deleting code, search imports, dynamic references, tests, scripts, configuration, and framework conventions. Exported Server Actions, route handlers, SQL functions, CLI tools, test seams, and optional backend integrations can be entry points without ordinary callers. Remove only verified dead code and its exclusive tests; preserve coverage of surviving behavior. Do not remove migrations or dynamic/print CSS based on text-search absence. Consolidate duplication only when authorization and behavioral contracts match.

### Regression coverage

For behavior fixes, reproduce the failure with a focused test when practical, then verify the fix. Test observable behavior, including relevant access denial and failure cases. Prefer existing test patterns and runner discovery. Do not add tests that merely assert implementation text or inflate counts for mechanical documentation/import changes.

## Verification and delivery

For application code changes, run relevant focused tests, then the repository gates appropriate to the final diff:

- `npm run typecheck` includes route generation and strict unused-local/parameter checks.
- `npm run lint` checks application and test sources.
- `npm test` runs the repository test runner.
- `npm run build` includes production compilation and bundle budget checks.
- For security scope, include `npm run audit:security` and `npm run audit:release`; distinguish unavailable network checks from passed checks.
- For UI or authenticated-flow changes, verify the affected journey when a safe environment is available. Credential-dependent skips remain verification gaps.
- Run `git diff --check` and review the final diff for unrelated changes and secrets. Documentation-only changes need structural/link checks, not a production build.

Use `.cache/` for local diagnostic output. Do not repeat expensive passing checks without new edits or unresolved evidence. Never describe skipped, unrun, or blocked checks as passing. Stop expanding scope when the requested issues are resolved and relevant checks pass; list remaining findings separately.

Return a concise report in the user's language: findings and root causes; files changed and why; measured before/after results when available; commands and pass/fail/skip outcomes; remaining risks or blocked verification; branch and commit/PR if present. Leave a reviewable local diff by default. Push, create a PR, merge, or deploy only when the user's authorization covers that action; do not ask again for an action already authorized.
