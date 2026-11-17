# Navicat password input implementation plan

**Goal:** Let the database owner enter a password in `public.profiles` using Navicat, including when inserting a new account.

**Design:** Add a nullable, write-only `password` column. An invoker-rights BEFORE trigger accepts nonblank input only from the table owner (or a role inheriting its privileges), validates 6–72 UTF-8 bytes with at least six characters, hashes with pgcrypto bcrypt cost 12, upserts private credentials, revokes sessions, and sets NEW.password to NULL before storage and auditing. Blank/NULL means keep the password unchanged. Defer the credentials-to-profile FK until commit so the BEFORE INSERT trigger can create credentials atomically. Existing scrypt credentials remain valid; bcryptjs verifies DB-created hashes. No web role or permission changes. The existing disabled user-management page remains unchanged.

**Threat boundaries:** Navicat uses owner credentials; runtime roles must not use the input trigger. Passwords and hashes must never appear in profile rows or audit payloads. Existing credentials must survive migrations. Reject bcrypt truncation and malformed hashes.

**Execution:** Inline in the current checkout to preserve the user's extensive uncommitted application changes for the Docker build. Do not reset, move, or commit unrelated work.

- [x] Add failing crypto and live database tests, then implement bcrypt verification and migration.
- [x] Generate matching Drizzle metadata, retain the original baseline, update baseline expectations to permit incremental migrations.
- [x] Run isolated database tests covering insert/update/blank/error/rollback/runtime restrictions/audit secrecy/session revocation.
- [x] Back up the running database, apply migration, rebuild Docker, and verify browser login using a disposable DB-created account plus existing scrypt admin.
- [x] Document Navicat usage and limits; review the scoped diff.

## Verification and review

- Six focused crypto/baseline/live tests pass; typecheck and scoped ESLint pass; production dependency audit reports zero vulnerabilities.
- Docker production build and bundle budgets pass; app and database are healthy.
- Browser checks pass for a DB-created bcrypt user, password change and session revocation, new-password login, existing scrypt admin login, and readiness HTTP 200. Disposable browser account removed afterward.
- Independent review found BEFORE INSERT side effects on skipped duplicate IDs. Added `0002_password_insert_conflict_guard.sql` to reject same-ID password inserts before changing credentials; regression test reproduced the failure and passes after the fix. Advisory lock serializes concurrent same-ID inserts.
- Follow-up review identified password-less concurrent inserts skipping the lock. `0003_serialize_all_profile_inserts.sql` locks every insert; a deterministic two-connection regression reproduced the problem before the fix and passes afterward. All applied migrations retained intact; follow-up fixes are additive.
- Full `npm test` stops at the unrelated `features/settings/components/category-lifecycle.test.tsx`: cannot find the category icon selection button. No category UI files changed for this feature.
- Backup: `.cache/navicat-password/before-migration.dump` (86,326 bytes).
