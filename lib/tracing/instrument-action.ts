import { logger } from '@/lib/logging'
import { metrics } from '@/lib/metrics'
import { config } from '@/lib/config'
import { startTimer, type Timer } from '@/lib/performance'
import { isApplicationError } from '@/lib/errors'
import { getRequestContext, withTraceContext, type RequestContext } from './context'

export type ActionStatus = 'success' | 'failure'

export interface ActionTraceMeta {
  feature: string
  action: string
  userId?: string
}

export interface ActionTraceHandle {
  context: RequestContext
  timer: Timer
  /** Call when the action completes (success or expected failure response). */
  complete(status: ActionStatus, details?: unknown): void
}

/** Begin tracing a server action — call complete() before returning. */
export async function beginActionTrace(meta: ActionTraceMeta): Promise<ActionTraceHandle> {
  const context = await getRequestContext(meta.userId)
  context.feature = meta.feature
  context.action = meta.action

  const timer = startTimer()
  let completed = false

  return {
    context,
    timer,
    complete(status: ActionStatus, details?: unknown) {
      if (completed) return
      completed = true

      const latency = timer.stop()
      const logPayload = withTraceContext(context, {
        operation: meta.action,
        feature: meta.feature,
        action: meta.action,
        userId: meta.userId,
        latency,
        status,
        details,
      })

      metrics.counter(`server_action.${status}`, 1, {
        feature: meta.feature,
        action: meta.action,
      })
      metrics.histogram('server_action.duration', latency, {
        feature: meta.feature,
        action: meta.action,
        status,
      })

      if (status === 'success') {
        logger.info(logPayload)
        if (latency >= config.observability.slowActionThresholdMs) {
          logger.warn({ ...logPayload, details: { ...(details as object), slow: true } })
        }
      } else {
        logger.warn(logPayload)
      }
    },
  }
}

/**
 * Wrap an async server action body with tracing, metrics, and error logging.
 * Re-throws NEXT_REDIRECT and ApplicationError; converts unexpected throws via caller.
 */
export async function traceAction<T>(
  meta: ActionTraceMeta,
  fn: (trace: ActionTraceHandle) => Promise<T>,
  options?: {
    classifyResult?: (result: T) => ActionStatus
  },
): Promise<T> {
  const trace = await beginActionTrace(meta)
  try {
    const result = await fn(trace)
    const status = options?.classifyResult?.(result) ?? 'success'
    trace.complete(status)
    return result
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }

    const status: ActionStatus = 'failure'
    trace.complete(status, isApplicationError(err) ? { code: err.code } : undefined)

    metrics.counter('server_action.failure', 1, {
      feature: meta.feature,
      action: meta.action,
    })

    logger.error(
      withTraceContext(trace.context, {
        operation: meta.action,
        feature: meta.feature,
        action: meta.action,
        userId: meta.userId,
        status: 'failure',
        latency: trace.timer.stop(),
      }),
      err,
    )

    throw err
  }
}

/** Classify ActionResponse-style results for traceAction. */
export function classifyActionResponse(result: {
  error?: string
  message?: string
  success?: boolean
  ok?: boolean
}): ActionStatus {
  if (result.error) return 'failure'
  if (result.success === false || result.ok === false) return 'failure'
  if (typeof result.message === 'string' && !result.success && !result.ok && result.message.includes('ไม่')) {
    return 'failure'
  }
  return 'success'
}
