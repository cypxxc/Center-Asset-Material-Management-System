# Cybersecurity & Infrastructure Defense Architecture — CAMMS Portal

**Date:** 2026-08-27  
**Author:** Antigravity Autonomous Cybersecurity & Infrastructure Defense Agent  
**Status:** Approved  
**Classification:** Internal Technical Design Document  

---

## 1. Executive Summary & Objective

This document defines the enterprise-grade **Cybersecurity & Infrastructure Defense Architecture** for the CAMMS Portal (Center Asset & Material Management System). Built on the principles of **Defense-in-Depth (Layered Security)** and **Zero Trust**, this architecture enforces active perimeter defense, granular identity and access control, application-level vulnerability mitigation (OWASP Top 10), real-time threat telemetry (SIEM logging), and automated security verification.

---

## 2. Five Core Defensive Pillars

### Pillar 1: Network & Perimeter Defense
1. **HTTP Security Headers & CSP:**
   - Enforce Content-Security-Policy (CSP) restricting scripts, objects, styles, fonts, frames, and connect endpoints.
   - Headers: `Strict-Transport-Security` (31536000s + preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
2. **Multi-Tier Rate Limiting (`lib/rate-limit.ts`):**
   - **Auth / Login:** 10 requests / 60 seconds window.
   - **Data Mutations (Create/Update/Delete/Restore):** 30 requests / 60 seconds window.
   - **Bulk Export / Reports:** 20 requests / 60 seconds window.
   - **General Read Operations:** 120 requests / 60 seconds window.
   - Breaches yield standard HTTP 429 status with `Retry-After` headers and rate-limit audit logging.

### Pillar 2: Identity & Access Management (Zero Trust)
1. **Principle of Least Privilege (PoLP):**
   - Strict role hierarchy: `admin` > `staff` > `viewer`.
   - Explicit server-side permission gates (`requireAdmin()`, `requireEditor()`, `requireAuth()`) in every Server Action.
2. **Session Integrity & Inactive Account Revocation:**
   - Active profile check: Users marked `is_active: false` in `profiles` have sessions immediately terminated in edge proxy and blocked in server actions.
   - Client isolation: Anon client (`createClient()`) enforces Postgres Row-Level Security (RLS) for all user actions; Admin client (`createAdminClient()`) is quarantined exclusively for Supabase Auth admin tasks and system migrations.

### Pillar 3: Application & Code Security (OWASP Top 10)
1. **Input Validation & Sanitization:**
   - Schema validation with Zod v4 enforcing upper-bound length limits, type validation, and pattern constraints on all mutations.
   - Unicode NFC Normalization on all string inputs to prevent visual spoofing and canonicalization bypasses.
   - CSV Formula Injection defense: Neutralize spreadsheet triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with single-quote escaping on import/export.
2. **File Upload & Path Traversal Guards:**
   - File uploads strictly validate MIME types (`image/jpeg`, `image/png`, `image/webp`) and file size limits (<= 5MB).
   - Filenames are sanitized via `normalizeFilename` with UUID-based storage keys to eliminate directory traversal (`../`) and illegal character injection.

### Pillar 4: Infrastructure & Data Protection
1. **Data in Transit & Rest:**
   - TLS 1.3/HTTPS strictly enforced on all public endpoints.
   - Database storage encrypted at rest (AES-256) via Supabase / PostgreSQL.
2. **Database Row-Level Security (RLS):**
   - RLS enabled on all core tables: `profiles`, `items`, `categories`, `locations`, `units`, `audit_logs`.
   - Immutable audit logging on all critical resource modifications.

### Pillar 5: Threat Detection, SIEM & Incident Response
1. **Standardized Security Event Logger (`lib/security-logger.ts`):**
   - Captures security events: `AUTH_FAILURE`, `RATE_LIMIT_EXCEEDED`, `UNAUTHORIZED_ACCESS_ATTEMPT`, `SUSPICIOUS_PAYLOAD`, `INACTIVE_ACCOUNT_ACCESS`, `ADMIN_ACTION`.
   - Emits structured JSON for SIEM ingestion and formatted incident summaries matching the Defense Agent standard schema:
     - `timestamp` & `severity` (`CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`)
     - `threatVector` / `eventCode`
     - `impactAnalysis`
     - `automatedActionTaken`
     - `recommendedFollowUp`
2. **Automated Containment:**
   - Automatic session invalidation upon inactive profile detection.
   - Sliding-window IP/user throttling on suspicious activity spikes.

---

## 3. Automated Security Verification & CI Tooling

### Security Test Suite & CLI Runner (`scripts/verify-security.ts`)
Run via `npm run audit:security`:
1. **Header & CSP Audit:** Validates all required headers in responses.
2. **Rate Limit Concurrency Test:** Validates window expiration, key isolation, and sliding window boundaries.
3. **Role Gating & Permission Boundary Tests:** Validates rejection of unauthorized role attempts.
4. **Sanitization Tests:** Asserts CSV injection neutralization, Unicode normalization, and path traversal rejection.
5. **Dependency Audit Gate:** Ensures zero high/critical vulnerabilities via `npm run audit:release`.

---

## 4. Implementation Components

| Component | Path | Responsibility |
|---|---|---|
| **Security Headers** | `lib/security-headers.ts` | CSP, HSTS, X-Frame-Options, Permissions-Policy |
| **Security Logger (SIEM)** | `lib/security-logger.ts` | Structured security incident logging & alerting |
| **Rate Limiting Engine** | `lib/rate-limit.ts` | Multi-tier sliding window rate limiter |
| **Edge Proxy** | `proxy.ts` | Request tracing, security headers, session gating |
| **Permission Helpers** | `lib/permissions.ts` | Role gating and Zero Trust verification |
| **Input Sanitizers** | `lib/unicode.ts`, `features/items/schema.ts`, `lib/supabase/storage.ts` | Data cleansing and anti-injection |
| **Security Verification Suite** | `scripts/verify-security.ts` + `lib/security.test.ts` | Automated CI verification & compliance tests |
| **Documentation & Runbook** | `SECURITY.md`, `INCIDENT_RESPONSE.md` | Incident response protocols and policy guide |

---

## 5. Verification Plan

1. **Unit & Integration Tests:** Execute `npm test` to verify all security assertions pass.
2. **Security Audit Runner:** Execute `npx tsx scripts/verify-security.ts` to assert end-to-end security compliance.
3. **Dependency Audit:** Execute `npm run audit:release` to ensure clean dependency posture.
4. **TypeScript & Linter:** Execute `npm run typecheck` and `npm run lint`.
