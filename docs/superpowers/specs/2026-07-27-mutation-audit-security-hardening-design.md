# Mutation, Audit, and Security Hardening Design

**Date:** 2026-07-27

## Objective

Correct the confirmed authorization, zero-row mutation, bulk-result, audit-integrity, and rate-limiting defects without changing the Thai-first product experience or introducing a third-party runtime dependency.

## Scope

This work covers:

- administrator account deletion safeguards;
- single and bulk item update, soft-delete, restore, and hard-delete result accuracy;
- audit records for the affected item mutations;
- clear separation between durable audit records and best-effort operational telemetry;
- a distributed Supabase/Postgres-backed rate limiter;
- regression tests, migration verification, and a controlled database release.

It does not redesign the admin UI, change the role hierarchy, add a new cache provider, or migrate every historical audit-writing call in one release.

## Design Decisions

### 1. Administrator deletion safeguards

`deleteAuthUser` remains a server-only action and continues to use the service-role client only after `requireAdmin` succeeds. Before calling the Auth Admin API it will:

1. validate `userId` as a UUID;
2. reject deletion when `userId` equals the acting administrator's profile ID;
3. load the target profile and reject a missing target;
4. when the target is an active administrator, count other active administrators and reject deletion if none remain.

The count and target checks use the service-role client so RLS cannot hide the target. The Auth user is deleted only after all safeguards pass. Because Supabase Auth deletion and public-schema writes cannot share one Postgres transaction, the action will preserve the target snapshot first, check every returned error, and write a durable audit record with an explicit failure path. Existing JWTs can remain valid until expiry after Auth deletion, so sensitive server actions continue to validate the current user and active profile on every call.

### 2. Exact mutation outcomes

All affected item mutations will request the primary key and any required audit fields with `select(...)`. Their response, audit targets, metrics, and Thai success count will be derived from the returned rows rather than the caller-provided ID array.

Shared validation will:

- normalize duplicate IDs;
- reject malformed UUIDs;
- cap one bulk request at 100 unique IDs;
- reject an empty bulk update payload;
- validate `status` against the supported item status set;
- validate nullable relation IDs as UUIDs when present.

Single restore and hard-delete operations return a not-found/already-processed error when zero rows are affected. Bulk operations may succeed partially, but the response reports the exact affected count and the audit contains only affected rows. A zero-row bulk result is an error.

Hard-delete prefetches `id`, `image_url`, and display fields. Audit records use `item.id`, never positional array matching. Storage deletion remains best-effort after the database commit because Supabase Storage cannot participate in a Postgres transaction; failures are logged with item IDs for recovery.

### 3. Durable audit boundary

`writeAuditLog` remains the non-blocking telemetry helper for events where delayed persistence is acceptable. Its structured log will no longer claim database persistence succeeded before the deferred insert completes.

Item mutations in this scope will use database functions that change item rows and insert their audit rows in one Postgres transaction. The functions will:

- run with a fixed empty `search_path` and fully qualified objects;
- validate `auth.uid()` and the active application role inside the function;
- return the exact affected rows;
- revoke execution from `PUBLIC` and `anon`;
- grant execution only to `authenticated`;
- avoid accepting a caller-supplied audit user ID.

The functions will be specific to the supported operations rather than exposing generic SQL or arbitrary table mutation. RLS remains enabled as defense in depth. Admin Auth deletion keeps a synchronous, checked audit insert because the external Auth operation cannot be made atomic with public Postgres data.

### 4. Distributed rate limiter

A new `private.rate_limit_windows` table stores only a SHA-256 hash of the request identity, the window start, count, and expiry. It is not exposed through the Data API and receives no `anon` or `authenticated` table grants.

A service-role-only database function performs an atomic increment-or-create operation and returns `allowed`, `remaining`, and `reset_at`. It uses a fixed search path and explicit schema qualification. The server derives the identity from:

- authenticated profile ID when available;
- otherwise a canonical client IP;
- the action name.

Only the first syntactically valid IP from trusted proxy headers is used, and the value is hashed before persistence. Login rate limiting fails closed with a safe retry message if the limiter is unavailable. Authenticated non-login mutations also reject the request when the limiter is unavailable, avoiding an unbounded fail-open path. Expired rows are deleted opportunistically in bounded batches inside the database function.

No external Redis/Upstash dependency is added; the existing Supabase database is the shared coordination point across application instances.

### 5. Migration and compatibility

One forward-only migration with the next unique five-digit prefix will create the private rate-limit objects and the operation-specific item functions. It will record itself in `public.app_migrations`, explicitly revoke default function execution, and preserve compatibility with the currently deployed application during rollout.

Database changes are deployed before the application code. The existing application continues to operate while the new functions are unused, which makes this safe for blue-green deployment. No table or column is dropped.

## Error Handling

- Validation errors return stable Thai messages without raw database details.
- Authorization failures do not reveal whether unrelated resource IDs exist.
- Zero-row results are distinguished from database errors.
- Audit insert failure causes transactional item mutation rollback.
- Storage cleanup failure does not roll back a completed hard delete, but it is logged with enough context for manual cleanup.
- Rate-limiter infrastructure failure rejects the protected operation and is logged without exposing the hashed key or credentials.

## Test Strategy

Implementation follows red-green-refactor for each behavior.

Regression coverage includes:

- self-deletion and last-active-admin rejection;
- malformed and missing target user IDs;
- zero-row restore and hard-delete responses;
- duplicate, malformed, oversized, partial-match, and out-of-order bulk IDs;
- exact affected counts and audit target IDs;
- rollback semantics encoded in the migration SQL;
- function grants excluding `PUBLIC` and `anon`;
- distributed limiter allow, deny, expiry, and infrastructure-failure behavior;
- canonical IP parsing and hashing;
- telemetry status wording when deferred persistence fails.

Verification runs `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, migration contract tests, `npm run verify-db-release`, and targeted live RPC checks after deployment. Browser smoke and authenticated release E2E run after the database migration and application code are both available in staging.

## Release Procedure

1. Confirm a recoverable Supabase backup/PITR state and record the target project.
2. Run the full local verification suite.
3. Apply only the new migration through the repository's explicit `MIGRATION_FILES` runner.
4. Run database readiness and targeted privilege/function checks.
5. Deploy the backward-compatible application code.
6. Run health, smoke, and authenticated release E2E checks.
7. Stop promotion if any database or authenticated E2E check fails; use the documented recovery procedure rather than an ad-hoc reverse migration.

## Success Criteria

- An administrator cannot delete their own account or the last active administrator.
- Item actions never report success for zero affected rows.
- Bulk counts and audit targets exactly match rows changed by Postgres.
- In-scope item mutations and their audit records commit or roll back together.
- Login and protected mutation limits are shared across application instances.
- Protected database functions are not executable by `PUBLIC` or `anon`.
- Existing tests plus all new regressions pass, and the production build and release checks remain green.
