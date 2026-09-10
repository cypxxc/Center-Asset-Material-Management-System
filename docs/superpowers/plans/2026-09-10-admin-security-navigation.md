# Admin security and navigation repair

User approved all reviewed fixes. Execute in this session; no database changes.

## Approved requirements
1. Active-admin authorization inside getProfilesList before any privileged client; direct-call negative tests.
2. Shared finite integer pagination bounds in users/audit queries/pages and getTableData. Defaults 1/50, page 1..100000 and page size 10..100; page UI receives normalized values.
3. Real per-operation table policy, audit_logs read-only through generic CRUD; per-table validated field allowlists and graceful invalid-payload errors. Preserve intentional admin CRUD and metadata normalization; enforce existing business constraints where applicable.
4. Investigate slow navigation using existing runtime logs. Middleware may use verified claims to avoid redundant auth-network lookup with asymmetric keys, retaining fresh getUser/profile checks in protected server code. No unsigned-session authorization, cross-user profile cache or key rotation.

## Evidence
Production deployment dpl_Ao96uttKYRJiYeTgAqbzAkCjPhG4 logs on 2026-09-10 07:34-07:38 UTC show proxy.auth.getUser 1.2-5.8s, auth.getCurrentUser up to6.2s and auth.getCurrentProfile up to7.7s. Items data/count also reach about5.9s. These are sampled slow calls, not percentiles; backend delay is real and middleware optimization alone cannot eliminate it.

## Execution ledger
- Query/pagination implementer owns queries, pagination helper, users/audit pages and tests.
- Table-policy implementer owns actions/policies/DB panel UI and tests; consumes shared pagination helper.
- Navigation implementer owns middleware and dedicated tests.
- Root reviews integration, executes test suite/lint/typecheck/build, records results.

Ruling: user request to fix all accepts the reviewed scope; no repeated design approval is needed. DB checks use test doubles, never production mutation. Reuse existing role/status safeguards rather than grant broader privileges.

## Verification
Focused regressions must cover denied identities, mutation field/type rejection, audit immutability and oversized pagination. Navigation tests cover invalid claims and cookie propagation. Run full tests, lint, typecheck and build after integration. Report live before/after latency as unverified until deployment and fresh traffic.
