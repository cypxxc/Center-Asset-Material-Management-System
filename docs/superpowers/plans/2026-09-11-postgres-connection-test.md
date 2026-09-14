# Docker PostgreSQL connection test implementation plan

**Goal:** Verify standalone Docker Desktop PostgreSQL access through Drizzle without Supabase credentials.

**Architecture:** An isolated Compose project with a named volume and loopback port. A CLI test loads only its own ignored environment file, exercises typed queries and transactions, restarts the container, and verifies persistence. This is a connection test, not a completed application backend migration.

**Spec:** ../specs/2026-09-11-postgres-docker-design.md

- [x] Add tests rejecting remote hosts, invalid ports, missing credentials, and inherited Supabase configuration in the test environment.
- [x] Add local configuration parsing and idempotent credential setup. Never overwrite .env.local or existing local PostgreSQL credentials.
- [x] Add Compose PostgreSQL with password authentication, loopback binding, health check and persistent volume.
- [x] Add Drizzle/pg and a real database test: typed insert/read/update/delete, rollback, persistence after restart, cleanup of only the test's unique schema.
- [x] Execute setup/start/test, typecheck, lint and dependency audit. Document the result and remaining application migration work accurately.
