# PostgreSQL on Docker with Drizzle ORM — proposed design

Status: fresh standalone Docker/Drizzle application implemented on 2026-09-14 following the user's instruction to create new data. PostgreSQL mode activated locally; Supabase data was not transferred. See ../../postgres/README.md for setup, verification, and operation.

## Objective

Support standalone PostgreSQL running in Docker with Drizzle ORM, without requiring Supabase services in that mode. Retain the current Supabase mode and intended application behavior. The user explicitly selected standalone PostgreSQL rather than a Docker-hosted Supabase stack, and requested Drizzle ORM integration.

## Default deployment

- Docker Compose runs PostgreSQL with a persistent named data volume and a health check. Bind its host port to loopback by default.
- Next.js continues to run on the host using the existing development/production commands. Containerizing Next.js is not required for this request.
- Select one backend for a deployment with `DATA_BACKEND=supabase|postgres`, defaulting to `supabase` for existing installations.
- PostgreSQL connection credentials are server-only. PostgreSQL mode validates its own required settings and does not require Supabase credentials.
- Use a dedicated new database for implementation and tests. Do not switch, migrate, overwrite, or reset the existing cloud database automatically.

## Data access and schema

- Add explicit server-side PostgreSQL operations behind the existing feature query/action entry points. Keep shared input validation, output types, authorization decisions, and audit intent visible.
- Use `drizzle-orm/node-postgres` with a shared `pg` connection pool in a server-only module. Drizzle handles PostgreSQL schema definitions and typed queries; existing Supabase operations remain the Supabase implementation.
- Use Drizzle query builders and parameterized `sql` expressions for custom operations, with allowlisted identifiers/sort fields. Do not expose arbitrary database access to the browser or create a general Supabase query-language emulator.
- Maintain separate PostgreSQL bootstrap/migrations derived from the currently required schema and domain functions. Drizzle Kit generates reviewed SQL migrations for this backend only. Preserve all existing Supabase migration files unchanged.
- Cover profiles, items, categories, locations, units, depreciation, report aggregates, import transactions, audit history, and backup/restore.
- Normal request connections must not bypass RLS or own protected tables. Within a Drizzle transaction, attach the identity from a verified server session using transaction-local settings and execute every protected operation through that same transaction object. Context expires before the pooled connection is released; never perform protected queries through the global client outside this boundary.
- Retain database-level role/row protections equivalent to existing policies. Port the identity helpers used by those policies to trusted transaction context; never accept a role/user identity directly from client input.
- Administrative operations use explicit server authorization and narrowly scoped elevated database access where required. Preserve disabled-by-default raw SQL access.

## Drizzle integration and migration workflow

- Runtime dependencies: `drizzle-orm` and `pg`; development dependencies: `drizzle-kit` and `@types/pg`. Verify compatible stable releases before installation and record them in the lockfile.
- Proposed layout: `lib/db/postgres.ts` for the server-only pool/transaction boundary, `db/postgres/schema.ts` (split by domain when useful) for Drizzle schemas, `db/postgres/migrations/` for the new migration history, and `drizzle.config.ts` for tooling.
- Infer internal row/insert types from Drizzle schemas while preserving current feature-facing DTOs. Keep runtime input validation; inferred TypeScript types do not validate requests.
- Map numeric, date/timestamp, JSON, and nullable values explicitly where needed to preserve current report calculations, serialization, and UI expectations.
- Use a separate migration credential (`DATABASE_MIGRATION_URL`) from the restricted runtime credential (`DATABASE_URL`). Never send either credential to client components. Migration tooling must target only the selected PostgreSQL installation.
- Workflow: change schema, generate migration, review SQL, then apply migrations through a documented command. Do not use schema push as the production migration process or run migrations during ordinary requests.
- Keep RLS policies, identity functions, triggers, grants, and database-specific functions in reviewed SQL migrations when they require custom SQL. ORM schema generation must not silently replace those protections.
- Drizzle manages database access; the authentication, private file storage, and live-update services below still require their own implementations.

## Authentication

- PostgreSQL mode owns password hashes and sessions in private tables, with no dependence on Supabase Auth or its development fallback.
- Store securely salted password hashes; use random opaque session tokens, store token hashes in the database, and deliver tokens in HttpOnly cookies with appropriate SameSite/Secure settings.
- Preserve login identifiers supported by the app (email, UUID, and unambiguous full name), active-account checks, rate limiting, sign-out, profile updates, password changes, and administrator user management.
- Validate session expiry and current profile state server-side. Revoke appropriate sessions when a user is disabled/deleted or credentials change.
- Create the initial administrator through an explicit local setup command with user-supplied credentials. Do not install a fixed production password.

## Images and files

- Store files in a configurable persistent directory owned by the Next.js server; store file metadata in PostgreSQL.
- Upload/read/delete endpoints enforce the same server permissions and size/type constraints as current image operations.
- Do not place private uploads in the public web directory. Use authenticated access or short-lived signed application URLs for private image retrieval.
- Preserve cropping, replacement, deletion, and image references in item records. Backup documentation distinguishes business-table exports from full backups including accounts and file bytes.

## Live updates

- Keep the existing Supabase realtime path in Supabase mode.
- In PostgreSQL mode, use a protected server event stream backed by PostgreSQL notifications. Send only invalidation hints for authorized tables; clients refetch through protected queries.
- Use a dedicated `pg` connection for notification listening, with reconnect and shutdown handling, separate from Drizzle request transactions.
- Reconnect on connection loss and perform a fresh invalidation on reconnect. Test listener cleanup, session expiry, role restrictions, and transaction commit behavior. Notifications are refresh hints, not a durable audit mechanism.

## Backups and compatibility

- Preserve the existing UI business-data backup format and atomic restore behavior for PostgreSQL-backed deployments.
- A full Docker installation backup also needs credentials/session policy, account data, database objects, and the private file directory; document and test that process separately from the UI export.
- Cross-backend migration of existing cloud accounts, password hashes, and stored files is not performed automatically. A dedicated migration plan is required if the user later requests moving existing data.

## Implementation batches

1. Backend configuration, Docker Compose, Drizzle schema/tooling and reviewed migrations, connection pooling, and fail-closed identity/RLS tests.
2. PostgreSQL login/sessions, initial administrator setup, profile/password changes, user administration, and authorization regression tests.
3. Feature queries/actions, imports, reports, audit, depreciation, and transactional backup/restore.
4. Private file storage and live-update delivery, including browser integration.
5. Documentation, fresh-install test, container stop/start persistence test, full automated checks, and authenticated browser journeys against the isolated Docker database.

The PostgreSQL mode is complete only after the full feature surface works without Supabase credentials. A container that starts or a database health check alone is not sufficient.

## Acceptance checks

- Existing Supabase tests/build continue passing.
- Fresh PostgreSQL setup creates schema and an initial administrator through the documented commands.
- Drizzle migrations apply successfully to an empty database and rerun without reapplying completed migrations; subsequent schema changes retain data and custom RLS/functions/triggers.
- Integration tests verify Drizzle transactions, rollback, and numeric/date/JSON/null mappings against the real Docker database.
- Authenticated admin/staff/viewer journeys enforce permissions on the server and at the database boundary.
- Item CRUD, filters, metadata, imports, exports, depreciation, images, audit, and user administration work in PostgreSQL mode.
- Backup/restore is atomic; failed restores leave existing data intact.
- Connection reuse cannot leak one user's identity to another; expired/disabled sessions fail closed.
- Realtime invalidations update other authorized browser sessions without leaking protected data.
- Database and uploaded files survive service restart.
- Typecheck, lint, unit/component/integration/security checks, production build, and authenticated Docker browser tests pass, with any external limitations reported explicitly.

## Known deployment constraint

The initial PostgreSQL mode targets a continuously running Node.js server with persistent local storage and an available database notification connection. Ephemeral/serverless multi-instance hosting needs shared object storage and an appropriate event-distribution design; that is a separate deployment expansion.

## Implementation references

- [Drizzle with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL row-level security in Drizzle](https://orm.drizzle.team/docs/rls)
