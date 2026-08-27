# Cybersecurity & Infrastructure Defense Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an enterprise-grade Cybersecurity & Infrastructure Defense framework across CAMMS Portal featuring structured SIEM security logging, multi-tier rate limiting, hardened security headers, input sanitization defense, and an automated CI security audit verification runner (`npm run audit:security`).

**Architecture:** A 5-layer Defense-in-Depth system combining edge security header enforcement, tiered sliding-window rate limiting with security logging, Zero-Trust role and session validation, robust input sanitization, and automated CLI security scanning.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict mode), Supabase (Postgres RLS), Node.js test runner (`tsx --test`), Zod v4.

## Global Constraints

- Use Node.js native test runner via `npx tsx --test <testfile>` for unit tests.
- Maintain Next.js 16 + React 19 App Router conventions (`proxy.ts` middleware, `@/` path aliases).
- Maintain zero runtime overhead on regular request paths.
- Ensure all automated actions and detections are fully auditable with standard severity schemas (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).

---

### Task 1: Structured SIEM Security Logger & Telemetry

**Files:**
- Create: `lib/security-logger.ts`
- Create: `lib/security-logger.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  export type SecurityEventType =
    | 'AUTH_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'UNAUTHORIZED_ACCESS_ATTEMPT'
    | 'SUSPICIOUS_PAYLOAD'
    | 'INACTIVE_ACCOUNT_ACCESS'
    | 'ADMIN_ACTION'

  export interface SecurityEvent {
    timestamp?: string
    severity: SecuritySeverity
    eventType: SecurityEventType
    threatVector: string
    impactAnalysis: string
    automatedActionTaken: string
    recommendedFollowUp: string
    actor?: {
      userId?: string
      ip?: string
      role?: string
      userAgent?: string
    }
    metadata?: Record<string, unknown>
  }

  export function logSecurityEvent(event: SecurityEvent): string
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// lib/security-logger.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { logSecurityEvent, type SecurityEvent } from './security-logger'

test('logSecurityEvent formats and outputs standard security incident schema', () => {
  const event: SecurityEvent = {
    severity: 'HIGH',
    eventType: 'RATE_LIMIT_EXCEEDED',
    threatVector: 'Brute-force / Credential Stuffing Indicator',
    impactAnalysis: 'Endpoint /api/login throttled for actor',
    automatedActionTaken: 'Issued HTTP 429 and blocked request',
    recommendedFollowUp: 'Monitor IP 192.0.2.1 for distributed probing',
    actor: { ip: '192.0.2.1', userId: 'anon' },
  }

  const formatted = logSecurityEvent(event)
  assert.match(formatted, /\[SECURITY INCIDENT\] \[HIGH\]/)
  assert.match(formatted, /Vector: Brute-force \/ Credential Stuffing Indicator/)
  assert.match(formatted, /Action Taken: Issued HTTP 429 and blocked request/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/security-logger.test.ts`
Expected: FAIL (module not found or function missing)

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/security-logger.ts
export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'SUSPICIOUS_PAYLOAD'
  | 'INACTIVE_ACCOUNT_ACCESS'
  | 'ADMIN_ACTION'

export interface SecurityEvent {
  timestamp?: string
  severity: SecuritySeverity
  eventType: SecurityEventType
  threatVector: string
  impactAnalysis: string
  automatedActionTaken: string
  recommendedFollowUp: string
  actor?: {
    userId?: string
    ip?: string
    role?: string
    userAgent?: string
  }
  metadata?: Record<string, unknown>
}

export function logSecurityEvent(event: SecurityEvent): string {
  const timestamp = event.timestamp || new Date().toISOString()
  const payload = {
    ...event,
    timestamp,
  }

  const summary = [
    `[SECURITY INCIDENT] [${event.severity}] ${timestamp}`,
    `Vector: ${event.threatVector}`,
    `Impact: ${event.impactAnalysis}`,
    `Action Taken: ${event.automatedActionTaken}`,
    `Follow-up: ${event.recommendedFollowUp}`,
  ].join('\n')

  // In production / server environments, log structured JSON for SIEM collectors
  if (process.env.NODE_ENV !== 'test') {
    console.warn(JSON.stringify({ tag: 'SIEM_EVENT', ...payload }))
  }

  return summary
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/security-logger.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/security-logger.ts lib/security-logger.test.ts
git commit -m "feat(security): add structured SIEM security logger and telemetry"
```

---

### Task 2: Enhanced Tiered Rate Limiting with Security Logging Integration

**Files:**
- Modify: `lib/rate-limit.ts`
- Create: `lib/rate-limit.test.ts`

**Interfaces:**
- Consumes: `logSecurityEvent` from `lib/security-logger.ts`
- Produces:
  ```typescript
  export type RateLimitTier = 'auth' | 'mutation' | 'export' | 'read'
  export const RATE_LIMIT_TIERS: Record<RateLimitTier, { limit: number; windowMs: number }>
  export async function checkRateLimit(
    actionName: string,
    tierOrLimit?: RateLimitTier | number,
    customWindowMs?: number
  ): Promise<CheckRateLimitResult>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// lib/rate-limit.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryRateLimiter, RATE_LIMIT_TIERS } from './rate-limit'

test('MemoryRateLimiter enforces sliding window limits and resets properly', async () => {
  const limiter = new MemoryRateLimiter(100)
  const key = 'test-ip:test-action'

  // Tier auth: 10 reqs per 60000ms
  for (let i = 0; i < 5; i++) {
    const res = await limiter.limit(key, 5, 1000)
    assert.equal(res.success, true)
  }

  // 6th request should fail
  const blockedRes = await limiter.limit(key, 5, 1000)
  assert.equal(blockedRes.success, false)
  assert.equal(blockedRes.remaining, 0)
  assert.ok(blockedRes.reset > Date.now())
})

test('RATE_LIMIT_TIERS configuration defines correct security thresholds', () => {
  assert.equal(RATE_LIMIT_TIERS.auth.limit, 10)
  assert.equal(RATE_LIMIT_TIERS.mutation.limit, 30)
  assert.equal(RATE_LIMIT_TIERS.export.limit, 20)
  assert.equal(RATE_LIMIT_TIERS.read.limit, 120)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/rate-limit.test.ts`
Expected: FAIL (`RATE_LIMIT_TIERS` undefined)

- [ ] **Step 3: Update `lib/rate-limit.ts` with tiers and SIEM logging**

Update `lib/rate-limit.ts` to export `RATE_LIMIT_TIERS` and automatically call `logSecurityEvent` when rate limits are exceeded for sensitive operations.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts
git commit -m "feat(security): implement tiered rate limiting presets with SIEM alerts"
```

---

### Task 3: Security Headers Verification & Hardening

**Files:**
- Modify: `lib/security-headers.ts`
- Create: `lib/security-headers.test.ts`

**Interfaces:**
- Produces: Hardened `SECURITY_HEADERS` dictionary and unit test coverage.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/security-headers.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { SECURITY_HEADERS } from './security-headers'

test('SECURITY_HEADERS includes strict OWASP-compliant security headers', () => {
  assert.equal(SECURITY_HEADERS['X-Frame-Options'], 'DENY')
  assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff')
  assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'], /max-age=31536000/)
  assert.match(SECURITY_HEADERS['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.match(SECURITY_HEADERS['Content-Security-Policy'], /object-src 'none'/)
})
```

- [ ] **Step 2: Run test to verify it passes / fails**

Run: `npx tsx --test lib/security-headers.test.ts`
Expected: PASS (or updated to ensure full compliance)

- [ ] **Step 3: Commit**

```bash
git add lib/security-headers.ts lib/security-headers.test.ts
git commit -m "test(security): add test suite for edge security headers and CSP"
```

---

### Task 4: Automated Security Audit Runner Script (`scripts/verify-security.ts`)

**Files:**
- Create: `scripts/verify-security.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: CLI command `npm run audit:security` executing comprehensive audit checks and reporting findings in Defense Agent output format.

- [ ] **Step 1: Create `scripts/verify-security.ts`**

Implement automated audit checks:
1. Validate Security Headers and CSP completeness.
2. Validate Rate Limiting sliding window calculations.
3. Validate Input Sanitization & Unicode normalization defenses.
4. Output formatted audit report with Timestamp, Severity, Threat Vectors, and Verification Status.

- [ ] **Step 2: Update `package.json`**

Add `"audit:security": "tsx scripts/verify-security.ts"` to `scripts`.

- [ ] **Step 3: Run the security audit CLI runner**

Run: `npm run audit:security`
Expected: PASS with 0 vulnerabilities detected.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-security.ts package.json
git commit -m "feat(security): add automated security audit runner and npm script"
```

---

### Task 5: Security Policy & Incident Documentation Update

**Files:**
- Modify: `SECURITY.md`
- Modify: `INCIDENT_RESPONSE.md`

- [ ] **Step 1: Update `SECURITY.md`**

Incorporate full 5-pillar Defense-in-Depth documentation, tiered rate limit specification, and SIEM security logging schema.

- [ ] **Step 2: Update `INCIDENT_RESPONSE.md`**

Add containment workflows for automated security events and triage matrix.

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md INCIDENT_RESPONSE.md
git commit -m "docs(security): update security policy and incident response runbook"
```

---

### Task 6: Full Verification & Quality Assurance

- [ ] **Step 1: Run complete test suite**
Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run security audit**
Run: `npm run audit:security`
Expected: All security gates pass.

- [ ] **Step 3: Run strict TypeScript check**
Run: `npm run typecheck`
Expected: Zero TypeScript diagnostics.

- [ ] **Step 4: Run linter**
Run: `npm run lint`
Expected: Clean pass.
