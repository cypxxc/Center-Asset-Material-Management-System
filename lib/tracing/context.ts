import { headers } from 'next/headers'
import { config } from '@/lib/config'
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  generateId,
} from './headers'

export interface RequestContext {
  requestId: string
  correlationId: string
  traceId: string
  userId?: string
  feature?: string
  action?: string
  environment: string
  hostname: string
}

let cachedHostname: string | undefined

function resolveHostname(): string {
  if (cachedHostname) return cachedHostname
  cachedHostname =
    process.env.HOSTNAME ??
    process.env.VERCEL_URL ??
    (typeof process !== 'undefined' ? 'localhost' : 'unknown')
  return cachedHostname
}

/** Read distributed trace IDs from the current request, with safe fallbacks for tests. */
export async function getRequestContext(userId?: string): Promise<RequestContext> {
  let requestId: string | undefined
  let correlationId: string | undefined
  let traceId: string | undefined

  try {
    const headersList = await headers()
    requestId = headersList.get(REQUEST_ID_HEADER) ?? undefined
    correlationId = headersList.get(CORRELATION_ID_HEADER) ?? undefined
    traceId = headersList.get(TRACE_ID_HEADER) ?? undefined
  } catch {
    // Non-request context (unit tests, scripts)
  }

  const rid = requestId ?? generateId()
  return {
    requestId: rid,
    correlationId: correlationId ?? rid,
    traceId: traceId ?? generateId(),
    userId,
    environment: config.env.nodeEnv,
    hostname: resolveHostname(),
  }
}

/** Merge request context into a log payload shape. */
export function withTraceContext(
  ctx: RequestContext,
  payload: {
    operation: string
    feature: string
    userId?: string
    action?: string
    latency?: number
    status?: string
    details?: unknown
  },
) {
  return {
    ...payload,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    userId: payload.userId ?? ctx.userId,
    environment: ctx.environment,
    hostname: ctx.hostname,
    action: payload.action ?? ctx.action,
  }
}
