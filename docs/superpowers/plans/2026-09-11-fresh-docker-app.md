# Fresh Docker PostgreSQL application implementation plan

Goal: Create a new empty standalone application database on Docker, using Drizzle, with no Supabase data transfer. The user's instruction to create it now approves implementation of the previously presented architecture.

Architecture: Preserve existing Supabase mode; DATA_BACKEND=postgres selects explicit server implementations. PostgreSQL owns profiles, credentials/sessions, registry tables and audit. Runtime SQL uses Drizzle transactions scoped to a verified session identity; separate authentication credentials access only profiles and private session/password tables. No generic Supabase query emulator.

Tasks and ownership:
1. Root: Drizzle schema/migrations, restricted database roles, transaction helpers, authentication/session integration, environment selection, setup page/first admin, health/live updates and integration verification.
2. Query implementer: features/items, settings, reports, depreciation queries. Preserve DTOs and pagination/filter/security behavior. Use withUserDatabase and Drizzle sql. Explicit postgres dispatch in existing entrypoints.
3. Mutation implementer: items/settings actions, bulk import and private image storage. Preserve validation, action output/revalidation and audit. Explicit postgres dispatch; no cloud calls in this path.
4. Admin implementer: all admin actions/queries, users, business backup/atomic restore, audit display. Enforce admin guard before elevated access; raw SQL disabled by default.

Shared interfaces: lib/postgres/db.ts exports getDatabase(), getAuthDatabase(), withIdentity(userId, callback), PostgresTransaction. lib/postgres/request.ts exports withUserDatabase(callback). lib/postgres/password.ts exports hashPassword(password), verifyPassword(password, encoded). lib/backend.ts exports isPostgresBackend(). Schema uses existing public table/column names; private_auth.credentials(user_id,password_hash), private_auth.sessions(token_hash,user_id,expires_at,created_at). Database triggers provide write audit. Auth connection cannot read registry data.

Verification: empty install + migration rerun; authenticated admin/staff/viewer operations; RLS denied anonymous/write viewer; transaction rollback and pooled identity isolation; local file access; session signout/revocation; no Supabase requests in PostgreSQL browser journeys; full typecheck/lint/build and relevant unit/integration tests. Review independent changes and final cross-feature integration. Keep all existing user edits and old migrations.

Ruling: Work in the existing codex/codebase-cleanup checkout because it contains the user's ongoing edits; do not create an isolated checkout that omits them. No commits or deployment requested. Database starts empty; initial administrator is established locally without a fixed seeded password.

Progress 2026-09-14:
- Database/schema/migrations, auth, queries, mutation/storage, admin, backup/restore, events and environment activation implemented.
- Three implementation reviews and independent final security review completed. Findings fixed: real SQL parameter typing, report bucket collisions, error sanitization, password/session races, forwarded-IP independent login throttle, metadata affected-row checks and alignment with original staff permissions, nullable depreciation invariant.
- Full unit suite, build/typecheck/lint, dependency audit and local security checks passed. Live query/admin/security tests passed. Fresh isolated database migration replay + atomic restore failure/success passed. Production browser and HTTP file/SSE tests passed. Local application running on port 3000 against Docker PostgreSQL, no Supabase configuration active.
- Pre-existing patch remains reversible except overlapping locations page hunk; manual inspection confirms original parallel query and inactive-user guard retained in its Supabase branch.
- No existing data transferred. Fixture cleanup confirmed empty registry and one initial administrator. Full backup created locally and archive content verified.
- Final MCP adapter added and verified with restricted-role live CRUD/security checks and real stdio read. Explicit operator profile required, read-only by default. All implementation tasks complete; production process started locally and verified on 2026-09-14.
