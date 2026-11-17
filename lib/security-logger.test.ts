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

test('logSecurityEvent formats correctly with custom and default timestamps', () => {
  const customTime = '2026-08-27T08:00:00.000Z'
  const eventWithTimestamp: SecurityEvent = {
    timestamp: customTime,
    severity: 'CRITICAL',
    eventType: 'SUSPICIOUS_PAYLOAD',
    threatVector: 'SQL Injection attempt detected in search query',
    impactAnalysis: 'Blocked query from executing against DB',
    automatedActionTaken: 'Rejected request with 400 Bad Request',
    recommendedFollowUp: 'Inspect payload pattern and block IP if repeated',
    actor: { ip: '198.51.100.23', userAgent: 'sqlmap/1.7' },
    metadata: { query: 'UNION SELECT * FROM profiles' },
  }

  const formatted = logSecurityEvent(eventWithTimestamp)
  assert.match(formatted, /\[SECURITY INCIDENT\] \[CRITICAL\] 2026-08-27T08:00:00\.000Z/)
  assert.match(formatted, /Impact: Blocked query from executing against DB/)
  assert.match(formatted, /Follow-up: Inspect payload pattern and block IP if repeated/)
})

test('logSecurityEvent formats low severity and info events without actor', () => {
  const event: SecurityEvent = {
    severity: 'INFO',
    eventType: 'ADMIN_ACTION',
    threatVector: 'Elevated role assignment audit',
    impactAnalysis: 'User role changed to admin',
    automatedActionTaken: 'Recorded in security audit stream',
    recommendedFollowUp: 'Verify administrative authorization ticket',
  }

  const formatted = logSecurityEvent(event)
  assert.match(formatted, /\[SECURITY INCIDENT\] \[INFO\]/)
  assert.match(formatted, /Vector: Elevated role assignment audit/)
})

test('logSecurityEvent emits structured JSON to console.warn in production environments', () => {
  const originalWarn = console.warn
  const originalNodeEnv = process.env.NODE_ENV
  const warnings: string[] = []

  try {
    console.warn = (msg: string) => {
      warnings.push(msg)
    }
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const event: SecurityEvent = {
      timestamp: '2026-08-27T10:00:00.000Z',
      severity: 'CRITICAL',
      eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      threatVector: 'Direct IDOR probing on /api/admin',
      impactAnalysis: 'Unauthorized access prevented by middleware',
      automatedActionTaken: 'Blocked with 403 Forbidden',
      recommendedFollowUp: 'Revoke compromised session token',
      actor: { userId: 'usr-999', role: 'viewer', ip: '203.0.113.10' },
      metadata: { targetRoute: '/api/admin/users' },
    }

    logSecurityEvent(event)

    assert.equal(warnings.length, 1)
    const parsed = JSON.parse(warnings[0])
    assert.equal(parsed.tag, 'SIEM_EVENT')
    assert.equal(parsed.severity, 'CRITICAL')
    assert.equal(parsed.eventType, 'UNAUTHORIZED_ACCESS_ATTEMPT')
    assert.equal(parsed.actor?.userId, 'usr-999')
    assert.equal(parsed.metadata?.targetRoute, '/api/admin/users')
  } finally {
    console.warn = originalWarn
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
  }
})
