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

## Required production environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

> Important: `SUPABASE_SERVICE_ROLE_KEY` must be stored securely in production and must never be committed to git.

## GitHub Actions secrets

In order for `npm run verify-env` to pass in CI, add the required Supabase values as repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

These will be injected into the workflow via `.github/workflows/ci.yml`.

## Manual deployment/staging items

1. Run pending database migrations from `db/migrations/` in the staging/production database.
2. Verify Supabase RLS policies and auth row-level security for `profiles`, `items`, and related tables.
3. Ensure the production deployment environment provides `SUPABASE_SERVICE_ROLE_KEY` privately.
4. Confirm admin users can create/reset accounts through the app without using Supabase Dashboard.
