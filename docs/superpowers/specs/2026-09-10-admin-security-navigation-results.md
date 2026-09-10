# Admin security and navigation changes

## Resolved code defects
- getProfilesList checks current active-admin identity before selecting a service client, matching the audit-list guard. Unauthorized direct calls return no rows.
- Shared pagination normalizes numbers and URL strings, rejects nonfinite/malformed inputs through defaults, and clamps page to1..100000 and size to10..100. Users/audit pages and query functions plus DB panel action use this boundary.
- Generic DB CRUD validates allowed operations and strict table-specific payload schemas. Managed metadata is stripped, unexpected fields rejected, UUID row identifiers validated and errors returned for UI display. Audit logs are read-only through generic CRUD, including the table-browser selection. Controlled SQL/restore paths remain distinct existing administrative capabilities.
- Profiles must be created/deleted through Auth user management; self deactivation/demotion is denied. Item patch validation checks merged state while writes preserve omitted fields, including depreciation constraints. Existing foreign keys still enforce reference validity.
- Name limits use grapheme counting to preserve valid Thai names accepted by ordinary forms. Regression covers full DB rows and boundary lengths.

## Navigation repair and evidence
Production slow-query logs in deployment dpl_Ao96uttKYRJiYeTgAqbzAkCjPhG4 (2026-09-10 07:34-07:38 UTC) show middleware Auth requests up to5.8s, server Auth requests up to6.2s, profile lookups up to7.7s and items queries about5.9s. These are slow-log samples, not percentile measurements.

Middleware now uses SDK getClaims for cryptographic validation and refresh. Protected server code retains getUser and active-profile checks, so current authorization is not replaced with decoded claims. Public JWKS discovery advertised ES256; asymmetric tokens can use cached public-key validation. Existing HS256 tokens still take the Auth fallback path.

Session cookies and cache-protection headers now survive redirects, including cleared cookies on invalid sessions. No user-specific response cache was introduced. Sidebar prefetch was not changed without a trace establishing it as a cause.

## Review
Independent review found a UTF-16 versus grapheme name-limit regression; fixed with a boundary test. Other reviewed areas: guard ordering, per-operation policies, pagination and cookie/header propagation.

## Limits
Final verification: full test runner passed all 117 files (exit0); lint, typecheck and production build passed. Chromium against the new local production build confirmed unauthenticated redirects from dashboard, admin users and DB panel to login. Independent re-review confirmed the Thai name defect resolved with no remaining findings in reviewed scope.

No production database data or schema was changed. No promise of a specific RES or navigation-time improvement. Backend profile/data delays remain a separate live measurement target; local tests cannot establish post-deployment field latency. Generic audit CRUD restrictions do not claim that privileged maintenance SQL or database ownership is immutable.

References: https://supabase.com/docs/reference/javascript/auth-getclaims and https://supabase.com/docs/guides/auth/server-side/creating-a-client
