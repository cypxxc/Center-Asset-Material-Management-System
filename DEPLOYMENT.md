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
[ ESLint ] (npm run lint)
       |
       v
[ Build Production Bundle ] (npm run build)
       |
       v
[ Playwright Smoke Tests ] (npm run test:smoke)
```

- **E2E Fallback in CI:** Playwright tests automatically skip active browser validations if real Supabase credentials are not present in repository secrets, avoiding PR build failures on forks.
- **Database-backed release E2E:** Run `npm run test:e2e:release` from the protected staging workflow. It requires `CAMMS_E2E_REAL_AUTH=true`, `CAMMS_E2E_ADMIN_ID`, and `CAMMS_E2E_ADMIN_PASSWORD`; missing values fail rather than skip.

---

## 2. Database Migrations Execution

Database schemas and RLS policies are maintained via SQL migration scripts in `db/migrations/`.

### Applying Migrations locally or to Staging/Prod:
```bash
# Always pass the exact migrations being deployed. The runner rejects an
# unspecified list to prevent replaying old migrations.
$env:MIGRATION_FILES='00026_atomic_database_restore.sql,00027_lock_down_admin_sql.sql,00028_revoke_authenticated_admin_sql.sql,00029_harden_profile_role_defaults.sql,00030_revoke_anon_admin_sql.sql,00031_lock_down_public_report_rpcs.sql'; npx tsx scripts/apply-migrations.ts
npm run verify-db-release
```

### Key Migration Guidelines:
1. **No Destructive Operations:** Never run `DROP COLUMN` or `DROP TABLE` in an active migration without a zero-downtime plan.
2. **Backward Compatibility:** Code must support both old and new schema structures during blue-green deployment windows.
3. **Unique Migration Numbers:** `00018_allow_staff_manage_metadata.sql` and `00018_import_items_bulk_tx_line_errors.sql` are a frozen historical exception and must never be renamed. Every new migration must use a unique five-digit prefix.
4. **Atomic execution:** The runner sends each migration file as one `exec_admin_sql` RPC transaction. Any statement failure returns a file-level error and rolls back that migration file.

---

## 3. Production Release Checklist

Before marking a deployment as successful, verify:
1. Environment variables pass `npm run verify-env`.
2. All Jest/JSDOM components and action tests pass.
3. Build completes cleanly without warnings: `npm run build`.
4. `/api/health` yields status `200` with database and storage marked `up`.
5. Apply all pending migrations before deploying application code. The database restore, admin SQL hardening, and public RPC lockdown migrations are required by the current application.
6. Keep `ADMIN_SQL_ENABLED` unset or `false` in normal production operation. Enable it only during a controlled maintenance window.
7. Confirm public Supabase Auth signups are disabled unless intentionally required. New profiles default to `viewer` through migration `00029`.
8. Run `npm run audit:release`; high and critical vulnerabilities must be zero. The PostCSS advisory is resolved by the non-breaking npm override in `package.json`.
9. Run `npm run test:e2e:release` against staging and require a complete authenticated pass.
10. Run `npm run verify-db-release` against the exact production target after migrations and before application traffic is promoted.

If migration verification fails, stop the release and keep the previous application deployment active. Database migrations are forward-only; restore from the verified backup only through the documented recovery procedure rather than attempting an ad-hoc reverse migration.
