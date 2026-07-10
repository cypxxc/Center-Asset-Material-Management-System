# Deployment & Release Guide (DEPLOYMENT.md)

This guide documents the procedures for deploying CAMMS production instances and running CI workflows.

---

## 1. CI/CD Workflow Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on push/PR to `main`:

```
[ Git Push / PR ]
       |
       v
[ Checkout Code & Node Setup ]
       |
       v
[ Install Dependencies ] (npm ci)
       |
       v
[ Environment Validation ] (npm run verify-env)
       |
       v
[ Unit, Component & Integration Tests ] (npm test)
       |
       v
[ Build Production Bundle ] (npm run build)
       |
       v
[ Playwright E2E Tests ] (npx playwright test)
```

- **E2E Fallback in CI:** Playwright tests automatically skip active browser validations if real Supabase credentials are not present in repository secrets, avoiding PR build failures on forks.
- **Database-backed E2E:** The unauthenticated redirect journey always runs; authenticated journeys require `CAMMS_E2E_REAL_AUTH=true` and seeded users.

---

## 2. Database Migrations Execution

Database schemas and RLS policies are maintained via SQL migration scripts in `db/migrations/`.

### Applying Migrations locally or to Staging/Prod:
```bash
# Always pass the exact migrations being deployed. The runner rejects an
# unspecified list to prevent replaying old migrations.
$env:MIGRATION_FILES='00026_atomic_database_restore.sql,00027_lock_down_admin_sql.sql,00028_revoke_authenticated_admin_sql.sql'; npx tsx scripts/apply-migrations.ts
```

### Key Migration Guidelines:
1. **No Destructive Operations:** Never run `DROP COLUMN` or `DROP TABLE` in an active migration without a zero-downtime plan.
2. **Backward Compatibility:** Code must support both old and new schema structures during blue-green deployment windows.

---

## 3. Production Release Checklist

Before marking a deployment as successful, verify:
1. Environment variables pass `npm run verify-env`.
2. All Jest/JSDOM components and action tests pass.
3. Build completes cleanly without warnings: `npm run build`.
4. `/api/health` yields status `200` with database and storage marked `up`.
5. Apply all pending migrations before deploying application code. The database restore and admin SQL hardening migrations are required by the current application.
6. Keep `ADMIN_SQL_ENABLED` unset or `false` in normal production operation. Enable it only during a controlled maintenance window.
7. Run `npm run audit:release`; high and critical vulnerabilities must be zero. The current moderate PostCSS advisory is a transitive dependency pinned by Next.js and has no safe non-breaking npm fix.
