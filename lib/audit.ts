import { headers } from 'next/headers'
import { after } from 'next/server'
import { withUserDatabase } from '@/lib/postgres/request'
import { sql } from 'drizzle-orm'
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
  persistToDatabase?: boolean
}

/**
 * Centrally records an audit event by outputting a structured log
 * and persisting it to PostgreSQL.
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

  if (payload.persistToDatabase === false) {
    return
  }

  const persist = async () => {
    try {
      const old_data = payload.oldValues 
        ? { values: payload.oldValues, ip, requestId, correlationId, traceId, timestamp }
        : null

      const new_data = payload.newValues
        ? { values: payload.newValues, ip, requestId, correlationId, traceId, timestamp }
        : { ip, requestId, correlationId, traceId, timestamp }

      await withUserDatabase((tx) => tx.execute(sql`insert into public.audit_logs(user_id,action,target_table,target_id,old_data,new_data)
        values(${payload.userId}::uuid,${payload.operation},${payload.targetType},${payload.targetId ?? null},${JSON.stringify(old_data)}::jsonb,${JSON.stringify(new_data)}::jsonb)`))
    } catch (error) {
      logger.error(
        {
          operation: 'writeAuditLogDb',
          feature: 'audit',
          audit_failure: true,
          userId: payload.userId || undefined,
          targetTable: payload.targetType,
          targetId: payload.targetId,
          requestId,
        },
        error
      )
    }
  }

  // Keep the response fast while allowing Next.js/Vercel to finish the write.
  try {
    after(persist)
  } catch {
    // Non-request contexts (for example unit tests) have no after lifecycle.
    await persist()
  }
}
