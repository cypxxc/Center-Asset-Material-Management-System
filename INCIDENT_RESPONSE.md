# Incident Response & Security Containment Runbook (`INCIDENT_RESPONSE.md`)

This runbook defines the incident lifecycle, severity categorization, SIEM telemetry integration, and operational containment playbooks for Registry-S (CAMMS Portal — Center Asset & Material Management System).

---

## 1. Incident Response Lifecycle

CAMMS adheres to the NIST SP 800-61 / ISO 27035 incident management lifecycle:

```
+----------------+      +----------------+      +-----------------+
| 1. Preparation | ---> |  2. Detection  | ---> | 3. Containment  |
|  & Readiness   |      |  & Triage      |      |  & Mitigation   |
+----------------+      +----------------+      +-----------------+
                                                         |
                                                         v
+----------------+      +----------------+      +-----------------+
|   6. Post-     | <--- |  5. Recovery   | <--- | 4. Eradication  |
| Incident (RCA) |      |  & Validation  |      |  & Forensics    |
+----------------+      +----------------+      +-----------------+
```

1. **Preparation & Readiness:** Automated CI security scans (`npm run audit:security`), strict RLS policies, least privilege IAM, and SIEM logging.
2. **Detection & Triage:** Structured JSON telemetry (`[SECURITY INCIDENT]`, `SIEM_EVENT`), automated alerts, readiness/liveness health probes.
3. **Containment & Mitigation:** Automated rate-limiting, session revocation, edge middleware blocking, and database transaction rollbacks.
4. **Eradication & Forensics:** Trace ID log extraction (`x-request-id`, `x-correlation-id`, `x-trace-id`), payload inspection, and root cause patch deployment.
5. **Recovery & Validation:** Re-running test suites, security audits, and database verification before traffic re-enablement.
6. **Post-Incident (RCA):** Post-mortem analysis and runbook updates within 48 hours.

---

## 2. SIEM Event Severity & SLA Matrix

All incidents and telemetry events are mapped to standardized operational and security severity tiers:

| Severity | Operational Priority | Definition & Impact | Examples | Response SLA | Escalation Target |
|---|---|---|---|---|---|
| **`CRITICAL`** | **P1** | Active breach, data integrity compromise, security bypass, full database/service outage, or CI security gate failure. | Database down, RLS bypass, CI `audit:security` regression failure, compromised service-role key. | **< 15 min** | All-Hands, Lead Architect, Platform Team |
| **`HIGH`** | **P2** | Direct attack vector detected, brute-force auth breach, privilege escalation attempt, or inactive account access. | `RATE_LIMIT_EXCEEDED` on auth tier, `UNAUTHORIZED_ACCESS_ATTEMPT` on admin actions, `INACTIVE_ACCOUNT_ACCESS`. | **< 30 min** | Security On-Call, Backend Team |
| **`MEDIUM`** | **P3** | Throttled abusive write/export traffic, neutralized injection payloads, or degraded service performance. | `RATE_LIMIT_EXCEEDED` on mutation/export tiers, `SUSPICIOUS_PAYLOAD` neutralized by sanitizers, p95 latency > 2s. | **< 2 hours** | Application Team |
| **`LOW`** | **P4** | Minor rate limit violations on read queries, transient validation failures, or localized UI glitches. | `RATE_LIMIT_EXCEEDED` on read tier, user input typos causing validation rejections. | Next business day | Assigned Engineer |
| **`INFO`** | **P5** | Routine security audits, scheduled scans, or administrative configuration changes. | `npm run audit:security` verification runs, normal role updates by admins. | Logged for audit trail | None (Historical Audit) |

---

## 3. First 15 Minutes Quick-Action Guide

When a high or critical alert fires:
1. **Identify the Severity & Alert Source:** Determine if it originates from SIEM (`tag: SIEM_EVENT`), `/api/health/readiness`, or user reports.
2. **Extract Trace & Correlation IDs:** Capture `x-request-id`, `x-correlation-id`, `x-trace-id`, and client IP from logs.
3. **Verify System State:**
   - Health Readiness: `curl -i http://localhost:3000/api/health/readiness`
   - Security Audit: `npm run audit:security`
   - Env check: `npm run verify-env`
4. **Initiate Incident Channel:** Post summary in `#incidents` with severity, affected components, trace IDs, and incident commander.
5. **Execute Relevant Containment Playbook:** Select from section 4 below.

---

## 4. Security Incident Triage & Containment Playbooks

### Playbook 1: `RATE_LIMIT_EXCEEDED` / Brute-Force & Scrape Mitigation

- **Trigger:** Multiple requests tripping sliding-window limiters (`auth`: 10/min, `mutation`: 30/min, `export`: 20/min, `read`: 120/min).
- **Severity:** `HIGH` for `auth`; `MEDIUM` for `mutation`/`export`; `LOW` for `read`.
- **Automated Action Taken:** Rate limiter rejects requests with HTTP 429 / localized cooldown message; logs `RATE_LIMIT_EXCEEDED` event.

#### Investigation Steps:
1. Query SIEM logs for `eventType: "RATE_LIMIT_EXCEEDED"` within the last 15 minutes.
2. Group events by `actor.ip`, `actor.userId`, and `metadata.actionName`.
3. Check for credential stuffing patterns (multiple distinct usernames from a single IP) or password spraying (single username targeted across multiple IPs).

#### Containment & Mitigation:
- **IP Perimeter Block:** If an external IP is flooding endpoints, add a temporary firewall/WAF block rule at Cloudflare/Vercel/Reverse Proxy.
- **Account Protection:** If an authenticated account is involved, inspect for account takeover. Trigger a password reset and invalidate active sessions in Supabase Auth.
- **Adjust Limits if False Positive:** If legitimate bulk staff operations hit mutation/export limits, adjust thresholds in `RATE_LIMIT_TIERS` (`lib/rate-limit.ts`).

---

### Playbook 2: `UNAUTHORIZED_ACCESS_ATTEMPT` / Role Escalation Containment

- **Trigger:** Non-admin user attempts an admin-only Server Action (`requireAdmin()`) or unauthorized resource mutation.
- **Severity:** `HIGH`.
- **Automated Action Taken:** Server Action halts immediately, returning an `AuthorizationError` to the client; logs `UNAUTHORIZED_ACCESS_ATTEMPT`.

#### Investigation Steps:
1. Locate log entries matching `eventType: "UNAUTHORIZED_ACCESS_ATTEMPT"`.
2. Identify the `actor.userId`, `actor.role`, client IP, and target `actionName`.
3. Query `audit_logs` table in Supabase for all recent operations performed by this `userId`.
4. Inspect database `profiles` table to ensure no unauthorized role changes occurred (`role = 'admin'` or `is_active` modifications).

#### Containment & Mitigation:
- **Immediate User Suspension:** Deactivate the compromised or rogue account immediately via admin console or direct SQL:
  ```sql
  UPDATE profiles SET is_active = false WHERE id = '<SUSPICIOUS_USER_ID>';
  ```
- **Session Revocation:** Revoke all active refresh tokens for the user in Supabase Auth dashboard.
- **Audit Ledger Verification:** Confirm no state mutations succeeded prior to the block.

---

### Playbook 3: `INACTIVE_ACCOUNT_ACCESS` Containment

- **Trigger:** An account with `profiles.is_active = false` attempts to log in, load pages, or call Server Actions.
- **Severity:** `HIGH`.
- **Automated Action Taken:** Edge middleware (`proxy.ts` / `lib/supabase/middleware.ts`) destroys session cookie, redirects to `/login?error=inactive`, and logs `INACTIVE_ACCOUNT_ACCESS`.

#### Investigation Steps:
1. Query SIEM logs for `eventType: "INACTIVE_ACCOUNT_ACCESS"`.
2. Determine how the request was initiated:
   - Stale browser cookie / cached session?
   - Replay of an expired JWT?
   - Offboarded employee attempting unauthorized re-entry?
3. Review HR / offboarding ledger to verify account deactivation status.

#### Containment & Mitigation:
- **Purge Supabase Auth Session:** Delete the user identity from Supabase Auth if the user has permanently left the organization.
- **Rotate API Keys / Webhooks:** If the inactive account was a service or automation account, rotate any shared secrets or integration tokens.

---

### Playbook 4: `SUSPICIOUS_PAYLOAD` / Injection & Path Traversal Investigation

- **Trigger:** Inbound input contains CSV formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`), path traversal sequences (`../`, `..\`), or prohibited script tags.
- **Severity:** `MEDIUM` (if automatically neutralized) to `HIGH` (if bypass suspected).
- **Automated Action Taken:** `lib/unicode.ts` sanitizers (`preventCSVInjection`, `normalizeFilename`, `stripBom`) sanitize strings before processing.

#### Investigation Steps:
1. Search SIEM logs for `eventType: "SUSPICIOUS_PAYLOAD"`.
2. Inspect the raw payload in `metadata` or trace logs.
3. Determine if the payload was a deliberate penetration test probe, automated bot scan, or accidental user entry (e.g., product model number starting with `-` or `+`).
4. Check destination storage bucket (`item-images`) and database tables to ensure no unescaped strings were persisted.

#### Containment & Mitigation:
- **Sanitizer Verification:** Ensure `preventCSVInjection()` and `normalizeFilename()` successfully neutralized the malicious string.
- **Schema Hardening:** If an unhandled vector was detected, update Zod regex patterns in `features/*/schema.ts` and add unit test test-cases to prevent regressions.
- **WAF Rule Update:** Add signature rules to upstream WAF to drop malicious payloads before they hit application runtimes.

---

### Playbook 5: `npm run audit:security` CI Gate Failure Remediation

- **Trigger:** CI/CD security audit runner (`scripts/verify-security.ts`) exits with non-zero status code during pull request or release build.
- **Severity:** `CRITICAL` (blocks release promotion).
- **Automated Action Taken:** CI runner halts the pipeline, preventing deployment of insecure artifacts.

#### Investigation Steps:
1. Check the CI build log for `[FAIL]` indicators across the 5 pillars:
   - **Pillar 1 Failures:** Missing or modified OWASP security headers (`Content-Security-Policy`, `X-Frame-Options`, `HSTS`) or altered rate limit tier thresholds in `lib/rate-limit.ts`.
   - **Pillar 3 Failures:** Regression in `preventCSVInjection`, `normalizeFilename`, or `stripBom` in `lib/unicode.ts`.
   - **Pillar 5 Failures:** Regression in `logSecurityEvent` JSON schema or output formatting in `lib/security-logger.ts`.
2. Run the audit locally to reproduce:
   ```bash
   npm run audit:security
   ```

#### Remediation Steps:
1. Revert unintentional modifications to `lib/security-headers.ts`, `lib/rate-limit.ts`, `lib/unicode.ts`, or `lib/security-logger.ts`.
2. If headers or limiters were intentionally changed, update `scripts/verify-security.ts` with explicit architectural approval.
3. Re-run `npm run audit:security` and `npm test` locally until all checks output `[PASS]`.
4. Push the corrective commit to re-trigger CI.

---

## 5. Infrastructure & Service Outage Playbooks

### Database Outage (`readiness.database = down`)

1. **Verify Connectivity:** Check Supabase status page and test direct connectivity via `npm run verify-env`.
2. **Check Connection Pool:** Ensure connection pool limits are not exhausted by orphaned serverless instances.
3. **Inspect Migration Drift:** Check whether recent migration statements caused locks or errors. To re-run approved migrations explicitly:
   ```bash
   $env:MIGRATION_FILES='<five-digit-migration-file>.sql'; npx tsx scripts/apply-migrations.ts
   npm run verify-db-release
   ```
4. **Execute Database Restore:** If data corruption occurred, follow `RECOVERY.md` using atomic backup snapshots.

### Storage Service Outage (`readiness.storage = down`)

1. **Verify Bucket Existence:** Ensure `item-images` bucket exists in Supabase Storage.
2. **Check Storage RLS Policies:** Ensure storage policies allow authenticated uploads and public/authenticated reads.
3. **Graceful Degradation:** Core asset CRUD and metadata remain functional even when image uploads degrade; inform staff that image attachments are temporarily disabled.

### High Error Rate Spike (`server_action.failure > 5%`)

1. **Query Structured Logs:** Filter logs by `status: "failure"`, group by `feature` and `action`.
2. **Correlate with Recent Deploys:** Check build ID from `GET /api/health/status`.
3. **Rollback Deploy:** If correlated with the latest release, trigger an immediate rollback to the previous stable release commit.

---

## 6. Incident Escalation & Roles

| Role | Responsibility | Contact |
|---|---|---|
| **Incident Commander (IC)** | Coordinates response, delegates investigation, authorizes production changes. | On-Call Lead / Architect |
| **Security Lead** | Analyzes attack vectors, performs forensic trace analysis, signs off on containment. | Security On-Call |
| **Platform / Ops Lead** | Manages hosting infrastructure, WAF rules, database connections, and rollbacks. | Platform On-Call |
| **Communications Lead** | Updates internal stakeholders, drafts status announcements, maintains incident timeline. | Operations Manager |

---

## 7. Post-Incident Review (RCA)

Within 48 hours of resolving any `CRITICAL` (P1) or `HIGH` (P2) incident:
1. **Draft Root Cause Analysis (RCA):** Document incident summary, timeline, root cause, impact metrics, and detection latency.
2. **Action Items:** Assign preventive engineering tasks (schema tightening, rate limit adjustments, test additions).
3. **Runbook & Policy Updates:** Update `SECURITY.md`, `INCIDENT_RESPONSE.md`, and automated checks in `scripts/verify-security.ts`.

---

*See also: `SECURITY.md` for defensive architecture specifications, `RUNBOOK.md` for standard operational runbooks, `RECOVERY.md` for disaster recovery, and `OBSERVABILITY.md` for telemetry tracing.*
