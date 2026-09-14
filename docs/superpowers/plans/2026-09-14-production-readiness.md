# Production readiness implementation plan

**Goal:** Resolve all five findings in docs/release-review/README.md with reproducible verification, and prepare a supervised HTTPS deployment and recoverable backups.
**Architecture:** Retain Next.js + Drizzle + standalone PostgreSQL. Keep restricted runtime roles. Use deployment configuration for a persistent Node server and TLS proxy; do not invent public DNS or erase existing data.
**Spec:** docs/release-review/README.md; user explicitly authorized resolving all findings.

## Constraints and rulings
- Preserve all existing work, secrets, business data and PostgreSQL volume; do not commit or publish.
- Continue on existing codex/codebase-cleanup checkout because this task depends on its uncommitted implementation.
- User has approved remediation scope. No repeat design approval needed. Endpoint/NAS/concurrency requested asynchronously; use 20 concurrent users as provisional test target, not a guaranteed production capacity.
- Use independently scoped agents per subagent-driven-development skill. Root integrates and reviews every change.

## Tasks
- [x] Root: align action/request limits with UTF-8 business limits and reproduce the 1.2 MB request regression against production; test upper boundaries.
- [x] Browser agent: diagnose intermittent edit failure with evidence; fix root cause, preserve semantics, repeat real CRUD journey.
- [x] Recovery agent: automate full dump+storage restore drill in isolated database and directory, verify credentials, RLS and actual restored web login/image; safe backup configuration/retention support as needed.
- [x] Deployment agent: add reproducible PostgreSQL CI gate and production Docker/web/TLS configuration, restart/health/logging; no replacing current DB or installing untrusted CA silently.
- [x] Root: authenticated concurrency test, integrate scripts/docs, run all tests/build/audit/live verification and independent code review.
- [x] Root: activate safe deployment steps possible with provided endpoint/storage; report exact remaining external requirements if any.

## Review and activation record
- Independent reviews approved hydration guard and async import handling; fixed missing verifier loopback validation and SSE setup timeout.
- Runtime deployment exposed YAML tmpfs comma parsing; quoted each mount option and verified actual nonroot secret/storage access.
- Production image built and local Caddy HTTPS activated against original PostgreSQL volume/storage. Verified certificate chain without installing CA into host trust store. Process-kill test recovered automatically.
- Docker Desktop current-user login autostart enabled; no reboot or global trust installation.
- 20-client/20-SSE/1,000-item load passed: 200 requests, zero errors, p95 943 ms.
- Backup runner real local run succeeded; installer and timeout/retry/lock tests passed. Off-machine destination and task-account activation remain pending user input; no scheduled task installed.
- Public/LAN endpoint and trusted certificate activation remain pending user hostname/network choice. Do not label this a completed public release or unattended pre-login boot deployment.
- Final combined suite: 464 passed / 0 failed / 3 opt-in skipped in 113 files; all three live opt-ins passed separately. Final lint/typecheck/build/audit passed; production Docker build and runtime tests passed.

## Verification
Failing before/passing after body-size reproduction; repeated CRUD with captured failure diagnostics; actual pg_restore with private file and restored auth; PostgreSQL CI script exercised locally; production build/typecheck/lint/unit/security/HTTP; bounded load using authenticated requests with explicit latency/error criteria. Verify deployed health and restart recovery without rebooting user's computer.
