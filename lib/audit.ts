import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { getRequestContext, withTraceContext } from '@/lib/tracing'

export interface AuditLogPayload {
  operation: string
  feature: string
  userId: string | null
  targetType: string
  targetId?: string
  oldValues?: unknown
  newValues?: unknown
  timestamp?: string
  requestId?: string
  correlationId?: string
  traceId?: string
  ip?: string
}

/**
 * Centrally records an audit event by outputting a structured log
 * and persisting it to the Supabase database.
 */
export async function writeAuditLog(payload: AuditLogPayload) {
  const ctx = await getRequestContext(payload.userId ?? undefined)
  let requestId = payload.requestId ?? ctx.requestId
  let correlationId = payload.correlationId ?? ctx.correlationId
  let traceId = payload.traceId ?? ctx.traceId
  let ip = payload.ip

  try {
    const headersList = await headers()
    if (!payload.requestId) {
      requestId = headersList.get('x-request-id') || requestId
    }
    if (!payload.correlationId) {
      correlationId = headersList.get('x-correlation-id') || correlationId
    }
    if (!payload.traceId) {
      traceId = headersList.get('x-trace-id') || traceId
    }
    if (!ip) {
      ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1'
    }
  } catch {
    // Graceful fallback for non-request contexts (e.g. unit tests)
  }

  const timestamp = payload.timestamp || new Date().toISOString()

  logger.info(
    withTraceContext(ctx, {
      operation: payload.operation,
      feature: payload.feature,
      userId: payload.userId || undefined,
      status: 'success',
      details: {
        audit: true,
        targetType: payload.targetType,
        targetId: payload.targetId,
        oldValues: payload.oldValues,
        newValues: payload.newValues,
        ip,
        timestamp,
      },
    }),
  )

  // 2. Persist to Supabase database (audit_logs table) - non-blocking
  // Fire and forget to avoid slowing down user operations
  setImmediate(async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      // Skip database persistence gracefully if Supabase env vars are not set (e.g. in unit tests)
      if (!supabaseUrl || !supabaseServiceKey) {
        return
      }

      const supabase = createServiceRoleClient()
      
      // Inject metadata into jsonb columns without schema migrations
      const old_data = payload.oldValues 
        ? { values: payload.oldValues, ip, requestId, correlationId, traceId, timestamp }
        : null

      const new_data = payload.newValues
        ? { values: payload.newValues, ip, requestId, correlationId, traceId, timestamp }
        : { ip, requestId, correlationId, traceId, timestamp }

      await supabase.from('audit_logs').insert({
        user_id: payload.userId,
        action: payload.operation,
        target_table: payload.targetType,
        target_id: payload.targetId || null,
        old_data,
        new_data,
      })
    } catch (error) {
      logger.error(
        {
          operation: 'writeAuditLogDb',
          feature: 'audit',
          userId: payload.userId || undefined,
          requestId,
        },
        error
      )
    }
  })
}
