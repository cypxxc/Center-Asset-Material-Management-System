// lib/logging/formatter.ts
import { LogPayload } from './types'

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}
    
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('cookie') ||
        lowerKey.includes('session') ||
        lowerKey === 'email' ||
        lowerKey.includes('phone')
      ) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeValue(obj[key])
      }
    }
    return sanitized
  }

  if (typeof value === 'string') {
    // Scrub JWT tokens: matches eyJ followed by base64 characters
    let scrubbed = value.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[JWT_TOKEN_REDACTED]')
    // Scrub Supabase keys / base64 keys
    scrubbed = scrubbed.replace(/sbp_[a-zA-Z0-9_-]{32,}/g, '[KEY_REDACTED]')
    return scrubbed
  }

  return value
}

export function formatLog(level: string, payload: LogPayload, err?: unknown): string {
  const errorObj = err instanceof Error ? err : null
  const sanitizedPayload = sanitizeValue(payload) as LogPayload

  const severityMap: Record<string, LogPayload['severity']> = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    AUDIT: 'audit',
  }

  const logLine = {
    timestamp: new Date().toISOString(),
    level,
    severity: sanitizedPayload.severity ?? severityMap[level] ?? 'info',
    environment: sanitizedPayload.environment || process.env.NODE_ENV || 'development',
    hostname:
      sanitizedPayload.hostname ??
      process.env.HOSTNAME ??
      process.env.VERCEL_URL ??
      'localhost',
    duration: sanitizedPayload.duration ?? sanitizedPayload.latency,
    error_message: errorObj ? errorObj.message : err ? String(err) : undefined,
    error_stack: errorObj ? errorObj.stack : undefined,
    ...sanitizedPayload,
  }
  return JSON.stringify(logLine)
}
