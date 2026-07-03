export interface LogPayload {
  operation: string
  feature: string
  action?: string
  userId?: string
  traceId?: string
  requestId?: string
  correlationId?: string
  latency?: number
  status?: string
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'audit'
  environment?: string
  hostname?: string
  duration?: number
  details?: unknown
}
