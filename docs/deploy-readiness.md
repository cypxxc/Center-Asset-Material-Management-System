# Deployment Readiness Checklist

## Completed checks

- [x] Removed development-only API endpoints from `app/api/debug-create-user` and `app/api/debug-reset-password`
- [x] Guarded verbose admin debug logs so they run only in non-production (`features/admin/actions.ts`)
- [x] Verified `.env*` files are ignored by `.gitignore`
- [x] Confirmed `npm run build` succeeds locally
- [x] Confirmed `npm test` passes successfully
- [x] Added a GitHub Actions workflow for CI (`.github/workflows/ci.yml`)
- [x] Added an environment validation script (`scripts/verify-env.ts`)
- [x] Added a deployment readiness summary document
- [x] Polished admin profile reset password UX with a separate action button
- [x] Verified audit log display improvements with unit tests, lint, and production build
- [x] Updated Next.js 16 cache revalidation usage to the two-argument `revalidateTag` signature
- [x] Hardened database backup export/restore with required tables and format version validation
- [x] Restricted raw SQL RPC execution to the server-role maintenance path
- [x] Removed fire-and-forget audit writes from item mutations
- [x] Added release dependency audit gate for high and critical vulnerabilities

## Required production environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVALIDATE_SECRET` if `/api/revalidate` is enabled for direct Supabase/admin tooling cache refresh

> Important: `SUPABASE_SERVICE_ROLE_KEY` must be stored securely in production and must never be committed to git.
> If `REVALIDATE_SECRET` is omitted, `/api/revalidate` intentionally returns 404.

## GitHub Actions secrets

In order for `npm run verify-env` to pass in CI, add the required Supabase values as repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

These will be injected into the workflow via `.github/workflows/ci.yml`.

## Manual deployment/staging items

1. Run pending database migrations from `db/migrations/` in the staging/production database.
   - This includes `00026_atomic_database_restore.sql`, `00027_lock_down_admin_sql.sql`, and `00028_revoke_authenticated_admin_sql.sql`.
   - Apply them with an explicit `MIGRATION_FILES` list; the runner rejects unspecified migration lists.
2. Verify Supabase RLS policies and auth row-level security for `profiles`, `items`, and related tables.
3. Ensure the production deployment environment provides `SUPABASE_SERVICE_ROLE_KEY` privately.
4. Confirm admin users can create/reset accounts through the app without using Supabase Dashboard.
5. Smoke test admin/staff/viewer login and role gates.
6. Smoke test item create, edit, soft delete, restore, and sidebar count refresh.
7. Smoke test DB Panel audit modal and item detail audit timeline with recent audit rows.
8. Smoke test backup export/import paths against staging data before production use.
9. Confirm `ADMIN_SQL_ENABLED` is disabled outside an approved maintenance window.
10. Run `npm run audit:release`; document any remaining moderate upstream advisories before approval.
