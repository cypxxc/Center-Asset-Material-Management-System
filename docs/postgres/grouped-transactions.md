# Grouped transaction deployment

The borrowing module uses one `disbursements` parent and distinct `disbursement_items` children. Official numbering remains approval-time; pending requests display their UUID request reference. Returning a child releases only that asset when its condition permits; the parent remains partially returned until every issued child is returned.

## Database targets

This checkout uses node-postgres/Drizzle, local sessions, and restricted `camms_app`/`camms_auth` connections. Both standalone PostgreSQL and Supabase-hosted PostgreSQL can use that same transactional transport. This does **not** restore the Supabase Auth, Storage, Realtime, or Data API clients absent from this checkout.

For hosted deployments use a database containing the existing CAMMS schema, identity helpers, and unchanged CAMMS roles/RLS policies. Configure `DATABASE_URL` with the restricted app role and `DATABASE_AUTH_URL` with the existing restricted auth role. Never run ordinary requests as database owner, service role, or a BYPASSRLS role. Do not apply the fresh-install schema on an existing Supabase dataset. Use the deployment's existing reviewed baseline migration process.

Supabase direct connections or session pooling support the transaction adapter; select a connection supported by the deployment's network and role configuration. See [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres). The module uses database transactions and transaction-local identity; it does not issue sequential REST writes.

## Migration

Grouped transaction integrity is included in `0000_final_schema.sql`, the single fresh-install baseline. Install new databases through `npm run postgres:app:setup`. Existing installations must be backed up and reconciled before adopting the baseline; see [final schema](final-schema.md). The CLI reads `.env.postgres.app`; verify the target before any migration.

The baseline's unique index rejects duplicate parent/item pairs and its issuance constraint rejects quantities above the request. Existing data must satisfy these constraints before adopting the baseline. Runtime and migration roles remain separate.

## Read-only compatibility verification

Run `node --import tsx scripts/verify-disbursement-backends.ts`. The standalone URL defaults to the local runtime configuration. Set `DISBURSEMENT_SUPABASE_TEST_URL` to a restricted hosted app connection to verify that target; connection values are never logged. A missing target is explicitly UNVERIFIED. The probe verifies structural prerequisites; it is not a substitute for lifecycle integration tests or a complete policy audit.

## Lifecycle regression

`POSTGRES_ADMIN_LIVE_TEST=1 node --import tsx --test tests/integration/postgres-disbursement-actions-live.test.ts` creates a randomly named disposable local database using `.env.postgres.app`, applies all migrations, and tests real actions/queries, reservation races, one-parent/three-child submission, approval, independent partial returns, duplicate returns, role guards, and final-write rollback. It removes only its own disposable database afterward.

The component suites `grouped-transactions.test.tsx`, `borrow-catalog-selection.test.tsx`, and `disbursement-list.test.tsx` verify document grouping, expansion, return controls and selection. Hosted lifecycle parity must be tested on a disposable Supabase environment before claiming hosted verification. Do not point fixture tests at production records.
