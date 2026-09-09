# Authentication and rate-limit hardening

Approved in conversation: Supabase Auth in every environment; PostgreSQL-backed limits.

## Contract
- Remove development identities, demo-password bypass, and process-global sessions. Existing unsigned cookies confer no identity.
- Verify users with Supabase Auth and read authorization from active database profiles. Preserve the authenticated session for restore RPCs.
- Enforce limits in PostgreSQL atomically with a bounded fixed window, shared across application instances. RPC callable only by service_role; counter table protected by RLS and grants. No memory fallback in request handling.
- Fail closed when request context, trusted IP configuration, database, or limiter responses are unavailable/invalid. Anonymous login uses an IP bucket; authenticated mutations use a user bucket independent of IP.
- Ignore forwarded headers unless configured for a trusted ingress. Vercel mode trusts its overwritten client-IP header; explicit proxy mode selects an address from the right using a configured trusted hop count. Default uses a shared unknown-IP bucket.
- Add guards to admin operations and existing uncovered item/account mutations. SQL stays disabled by default, requires explicit confirmation, and records an audit attempt before execution; do not execute if audit persistence fails.
- Rename service-role factories consistently and add server-only import boundaries. Use timing-safe comparison for revalidation secrets.
- Do not perform unrelated large-component refactors. SQL confirmation is the only planned UI change.

## Validation and rollout
Regression tests cover forged cookies and missing sessions, proxy parsing, unavailable limiter, cross-client counter sharing/concurrency, authorization and admin gates. Run typecheck, lint, complete tests and production build. Validate SQL locally in a disposable PostgreSQL runtime if available. Deliver a reviewed migration and deployment instructions; do not silently apply changes to a remote database. Apply migration before deploying application code; configure trusted ingress before traffic is enabled. Demo users must have real Supabase Auth accounts.

## Rulings
- Use the existing checkout on a dedicated codex branch so current dependencies remain available.
- The conversation approval is the design review; avoid a duplicate approval request for the same design.
- Use a fixed window (at most twice the limit around adjacent window boundaries), documented instead of promising sliding-window semantics.
