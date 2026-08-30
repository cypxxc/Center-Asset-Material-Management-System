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
