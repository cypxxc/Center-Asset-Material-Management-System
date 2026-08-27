# Security Policy & Defense-in-Depth Architecture (`SECURITY.md`)

This document details the cybersecurity defense architecture, operational controls, and security policies implemented in Registry-S (CAMMS Portal — Center Asset & Material Management System).

---

## 1. Security Architecture & Defense Philosophy

CAMMS employs a **Defense-in-Depth (DiD)** cybersecurity model structured across 5 distinct defense pillars. No single layer of defense is considered sufficient on its own. If a perimeter control or single security check fails, secondary and tertiary layers (application validation, role-based authorization, database Row-Level Security, immutable audit trails) prevent unauthorized access, privilege escalation, and data compromise.

```
+-----------------------------------------------------------------------------------+
|  Pillar 1: Network & Perimeter Defense                                           |
|  - Edge Security Headers (CSP, HSTS, X-Frame-Options, Permissions-Policy)        |
|  - Multi-Tier Sliding Window Rate Limiting (auth, mutation, export, read)         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  Pillar 2: Identity & Access Management (IAM)                                     |
|  - Zero Trust & Principle of Least Privilege (PoLP: admin > staff > viewer)       |
|  - Server-Action Authorization Guards & Inactive Account Middleware Gating        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  Pillar 3: Application & Code Security                                            |
|  - Zod Runtime Schema Validation & String Boundary Caps                          |
|  - Unicode NFC Normalization, BOM Stripping, CSV Formula Injection Defense        |
|  - Path Traversal Neutralization & React Context-Aware Output Escaping           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  Pillar 4: Infrastructure & Cloud Workload Defense                                |
|  - PostgreSQL Row-Level Security (RLS) Enforced on All Production Tables          |
|  - Immutable Database Audit Logs & Triggers with Trace ID Correlation             |
|  - Dual Supabase Client Isolation (Anon vs Service Role)                         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  Pillar 5: Threat Detection & SIEM Telemetry                                      |
|  - Standardized Severity Matrix (CRITICAL, HIGH, MEDIUM, LOW, INFO)               |
|  - Structured JSON SIEM Event Logging (`lib/security-logger.ts`)                  |
|  - Autonomous Security Audit Runner CLI (`npm run audit:security`)               |
+-----------------------------------------------------------------------------------+
```

---

## 2. The 5-Pillar Defense-in-Depth Matrix

### Pillar 1: Network & Perimeter Defense

#### 1.1 OWASP Edge Security Headers
All HTTP responses passing through the Edge middleware (`proxy.ts` / `lib/security-headers.ts`) and Next.js server configuration (`next.config.ts`) are injected with strict OWASP-recommended HTTP security headers:

| Header | Configured Value | Security Purpose |
|---|---|---|
| **`Content-Security-Policy`** | `default-src 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com;` | Prevents cross-site scripting (XSS), unauthorized script injection, malicious frame embedding, and rogue websocket connections. |
| **`X-Frame-Options`** | `DENY` | Prevents clickjacking attacks by blocking frame/iframe rendering from any origin. |
| **`X-Content-Type-Options`** | `nosniff` | Disables MIME-type sniffing, enforcing declared MIME types. |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Protects privacy by omitting sensitive URL query strings to external origins. |
| **`Strict-Transport-Security`** | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS connections for 1 full year, including subdomains, with HSTS preload readiness. |
| **`Cross-Origin-Opener-Policy`** | `same-origin` | Isolates the browsing context from cross-origin popups/windows. |
| **`Cross-Origin-Resource-Policy`**| `same-origin` | Restricts resource loading to the same origin. |
| **`Permissions-Policy`** | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Blocks access to device hardware (camera, microphone, geolocation) and disables FLoC/interest-cohort tracking. |

#### 1.2 Multi-Tier Sliding Window Rate Limiting
To protect against brute-force attacks, denial-of-service (DoS), and automated scraping, Server Actions and sensitive endpoints are guarded by a tiered rate limiter (`lib/rate-limit.ts`).

- **Identifier Key:** `${userId}:${ip}:${actionName}` (combines authenticated user ID, client IP from `x-forwarded-for`/`x-real-ip`, and specific action name).
- **Algorithm:** In-memory sliding window log with automated garbage collection timer (`.unref()` compatible for graceful server shutdown and test runner execution).
- **Extensibility:** Implements the `RateLimiter` interface, enabling drop-in integration with Redis or Upstash for multi-instance distributed deployments.

##### Rate Limit Tier Contracts

| Tier | Limit | Window | Target Operations & Endpoints | Defense Objective |
|---|---|---|---|---|
| `auth` | **10 req** | 60,000 ms (1 min) | `loginAction`, `resetPassword`, credential verification | Mitigates brute-force credential stuffing, password spraying, and authentication flooding. |
| `mutation` | **30 req** | 60,000 ms (1 min) | `createItem`, `updateItem`, `deleteItem`, `restoreItem`, `createCategory`, `createLocation`, `createUnit` | Prevents database write flooding, race condition exploits, and malicious data tampering. |
| `export` | **20 req** | 60,000 ms (1 min) | `exportItemsCsvAction`, `generateReportExcel`, report downloads | Prevents server memory/CPU exhaustion from large data serialization and report generation attacks. |
| `read` | **120 req** | 60,000 ms (1 min) | Search autocompletion, catalog filtering, detail lookups | Prevents automated data scraping and rapid enumeration of asset inventories. |

When any rate limit tier is breached:
1. The request is rejected with a localized Thai error message specifying the remaining retry cooldown in seconds.
2. A structured `RATE_LIMIT_EXCEEDED` security event is logged to SIEM with client IP, user ID, and reset window timestamp (`HIGH` severity for `auth`, `MEDIUM` for others).

---

### Pillar 2: Identity & Access Management (IAM)

#### 2.1 Zero Trust & Principle of Least Privilege (PoLP)
Access to system operations follows a strict hierarchical Role-Based Access Control (RBAC) model:
- **`admin`**: Full administrative privileges (asset CRUD, metadata configuration, user role management, system audits, trash purge).
- **`staff`**: Operational staff privileges (asset create/edit, status updates, metadata view). Restricted from modifying user roles, deleting core system settings, or performing hard deletes.
- **`viewer`**: Read-only access to asset lists, details, and reports. All mutation actions are strictly rejected.

#### 2.2 Server-Action Authorization Enforcement
Client-side permission checks are treated as purely cosmetic UI hints. Every mutation executes authoritative server-side permission checks via `lib/permissions.ts` and `features/auth/queries.ts`:
- `requireAuth()`: Verifies valid active session.
- `requireEditor()`: Enforces `admin` or `staff` role.
- `requireAdmin()`: Enforces `admin` role strictly.

Any unauthorized attempt is rejected with an `AuthorizationError` and triggers a high-severity SIEM security log.

#### 2.3 Role Escalation & Privilege Separation
- User role assignments (`role` field on `profiles`) are protected by PostgreSQL RLS policies that disallow self-updates.
- Role modifications can only be performed by administrators via `createAdminClient()`.
- Public signups default new accounts to `viewer` role (`db/migrations/00029_harden_profile_role_defaults.sql`).

#### 2.4 Inactive Account Gating
- Account status (`is_active` boolean on `profiles`) is checked on every request via Edge middleware (`proxy.ts` / `lib/supabase/middleware.ts`).
- If an account is deactivated, all active sessions are immediately invalidated and redirected to `/inactive`.
- Any attempt by a deactivated account to call server actions is blocked and emits an `INACTIVE_ACCOUNT_ACCESS` security event.

---

### Pillar 3: Application & Code Security

#### 3.1 Zod Runtime Schema Validation
All inbound payloads to Server Actions are validated at runtime using Zod v4 schemas (`features/*/schema.ts`):
- Strict data typing prevents type juggling and unexpected property injection.
- Explicit length caps on all string inputs (e.g. Item Name <= 255 characters, Brand/Model <= 150 characters, Descriptions <= 2000 characters) prevent memory buffer exhaustion and ReDoS attacks.

#### 3.2 Unicode Normalization & BOM Sanitization
All textual inputs and search queries are preprocessed through `lib/unicode.ts`:
- **NFC Normalization:** Preprocesses strings to Unicode Normalization Form C, preventing homoglyph confusion and collation bypass.
- **BOM Stripping (`stripBom`):** Automatically removes Byte Order Marks (`\uFEFF`, `\uFFFE`) from CSV and file imports.

#### 3.3 CSV & Spreadsheet Formula Injection Defense
Any data exported to CSV or processed from imports is sanitized via `preventCSVInjection()` (`lib/unicode.ts`):
- Prepends a single quote `'` to any cell value beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- Prevents Dynamic Data Exchange (DDE) and formula execution vulnerabilities when spreadsheets are opened in Microsoft Excel or LibreOffice Calc.

#### 3.4 Path Traversal Neutralization
File uploads (e.g., asset image attachments) are sanitized via `normalizeFilename()` (`lib/unicode.ts`):
- Replaces path traversal sequences (`..`, `/`, `\`) and control characters with underscores.
- Validates file extensions and limits storage keys to safe alphanumeric slugs.

#### 3.5 Cross-Site Scripting (XSS) Mitigation
- React DOM automatic context-aware escaping renders all user-supplied data safely.
- Raw HTML injection (`dangerouslySetInnerHTML`) is strictly disallowed across all application components.
- Strict CSP disallows inline script injection from untrusted origins.

---

### Pillar 4: Infrastructure & Cloud Workload Defense

#### 4.1 PostgreSQL Row-Level Security (RLS)
Every database table (`items`, `profiles`, `categories`, `locations`, `units`, `audit_logs`) has PostgreSQL Row-Level Security permanently enabled (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`).
- RLS policies ensure authenticated users can only query and mutate rows permitted by their role and active status.
- Anonymous/unauthenticated requests cannot read or modify protected tables.

#### 4.2 Immutable Database Audit Trails
- All state mutations (create, update, delete, restore, hard-delete) are logged to the `audit_logs` table.
- Audit entries record the actor's user ID, IP address, timestamp, action type, before/after record states, and distributed trace IDs (`requestId`, `correlationId`, `traceId`).
- Deletion or modification of `audit_logs` records is prevented by RLS policies.

#### 4.3 Dual Supabase Client Architecture & Secret Isolation
- **Standard Client (`createClient()`):** Uses the public Anonymous key + user JWT. All database operations strictly obey Postgres RLS.
- **Admin Client (`createAdminClient()` / `createServiceRoleClient()`):** Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS strictly for server-side auth administration and system readiness checks (`/api/health/readiness`).
- **Secret Isolation:** `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_`, is excluded from client bundles, and is never exposed to browser environments.

---

### Pillar 5: Threat Detection & SIEM Telemetry

#### 5.1 Standardized Severity Matrix
Security events logged through `lib/security-logger.ts` conform to a 5-level severity standard:

| Severity | Definition | Target Scenarios | Response SLA |
|---|---|---|---|
| `CRITICAL` | Active compromise, security bypass, total service failure, database corruption, or CI security gate failure. | Active exploit detected, RLS policy failure, compromised service key, CI audit runner failure. | **< 15 minutes** (All-hands) |
| `HIGH` | Elevated security threat, unauthorized access attempt, brute-force attack, or inactive account access. | Auth rate limit breached, role escalation attempt, inactive account API call. | **< 30 minutes** (Security On-Call) |
| `MEDIUM` | Suspicious behavior, rate limit violation on write operations, or neutralized injection attempt. | Mutation/export rate limit exceeded, CSV formula trigger detected and sanitized. | **< 2 hours** (App Team) |
| `LOW` | Minor anomaly or read rate limit violation. | Read tier rate limit hit, transient client-side malformed request. | Next business day |
| `INFO` | Routine operational security event or audit record. | Scheduled security audit scan (`npm run audit:security`), administrative configuration change. | Logged for audit trail |

#### 5.2 Security Event Types (`SecurityEventType`)
The telemetry system tracks 6 canonical event types:
1. `AUTH_FAILURE`: Failed authentication attempts or invalid session tokens.
2. `RATE_LIMIT_EXCEEDED`: Rate limit thresholds breached on any tier.
3. `UNAUTHORIZED_ACCESS_ATTEMPT`: Unauthorized access attempt to restricted endpoint or action.
4. `SUSPICIOUS_PAYLOAD`: Input containing injection patterns, path traversal strings, or malicious signatures.
5. `INACTIVE_ACCOUNT_ACCESS`: Deactivated account attempting portal or action access.
6. `ADMIN_ACTION`: Sensitive administrative mutations (role modification, hard deletion, audit scans).

#### 5.3 Structured JSON Telemetry Schema
In production and server environments, `logSecurityEvent()` outputs structured JSON tagged with `SIEM_EVENT` for ingestion by SIEM collectors (Datadog, Splunk, Elastic Stack, AWS CloudWatch, Google Cloud Logging):

```json
{
  "tag": "SIEM_EVENT",
  "timestamp": "2026-08-27T09:30:00.000Z",
  "severity": "HIGH",
  "eventType": "RATE_LIMIT_EXCEEDED",
  "threatVector": "Rate limit exceeded on action 'loginAction'",
  "impactAnalysis": "Throttled requests from actor (limit: 10, window: 60000ms)",
  "automatedActionTaken": "Blocked request and returned rate limit error message",
  "recommendedFollowUp": "Monitor IP 192.0.2.1 and user anonymous for suspicious high-frequency activity",
  "actor": {
    "userId": "anonymous",
    "ip": "192.0.2.1",
    "role": "anonymous",
    "userAgent": "Mozilla/5.0..."
  },
  "metadata": {
    "actionName": "loginAction",
    "tier": "auth",
    "limit": 10,
    "windowMs": 60000,
    "resetAt": "2026-08-27T09:31:00.000Z"
  }
}
```

#### 5.4 Autonomous Security Audit Runner CLI
The security posture of CAMMS is continuously verified via `scripts/verify-security.ts`:

```bash
npm run audit:security
```

This runner validates the defense pillars:
- **Pillar 1 (Network & Perimeter):** Verifies presence and exact values of all 8 OWASP security headers and rate limiter tier contracts.
- **Pillar 3 (Application & Code):** Verifies CSV injection neutralization, path traversal sanitization, and BOM stripping.
- **Pillar 5 (Threat Detection & SIEM):** Verifies SIEM structured logging formats and incident report outputs.

Failure of any check exits with code `1` and halts CI/CD release pipelines.

---

## 3. Dependency Security & Release Auditing

Release CI pipelines enforce automated vulnerability scanning:
- `npm run audit:release`: Evaluates production dependencies, failing if high or critical vulnerabilities exist.
- Non-breaking npm `overrides` in `package.json` resolve known transitive advisories.
- Transitive dependencies are reassessed with each minor/major framework upgrade.

---

## 4. Vulnerability Disclosure & Responsible Reporting

If you discover a potential security vulnerability in CAMMS, please report it responsibly:
- **Email:** `security@camms-internal.local` (or contact the internal cybersecurity response team).
- **Required Information:** Description of vulnerability, step-by-step reproduction guide, affected endpoints/components, and potential impact analysis.
- **SLA:** Initial acknowledgment within 24 hours; triage and mitigation plan within 48 hours.
- Please do not disclose vulnerabilities publicly or to unauthorized parties before remediation is complete.

---

*See also: `INCIDENT_RESPONSE.md` for security incident containment playbooks, `OBSERVABILITY.md` for telemetry guidelines, and `DEPLOYMENT.md` for release checklists.*
