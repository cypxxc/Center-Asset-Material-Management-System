import { ActionResponse, errorResponse } from '@/lib/actions-helper'
import { logger } from '@/lib/logging'
import { isApplicationError, toSafeErrorMessage } from '@/lib/errors'
import { getRequestContext, withTraceContext } from '@/lib/tracing'
import { metrics } from '@/lib/metrics'

/**
 * Handles unexpected server errors inside Server Actions.
 * Logs the error stack to stderr/observability dashboard,
 * and returns a localized safe error response to client.
 */
export async function handleActionError<T = unknown>(
  err: unknown,
  operation: string,
  feature: string,
  userId?: string,
): Promise<ActionResponse<T>> {
  if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
    throw err
  }

  const ctx = await getRequestContext(userId)

  metrics.counter('server_action.failure', 1, { feature, action: operation })

  logger.error(
    withTraceContext(ctx, {
      operation,
      feature,
      action: operation,
      userId,
      status: 'failure',
      details: isApplicationError(err) ? { code: err.code, operational: err.isOperational } : undefined,
    }),
    err,
  )

  return errorResponse(toSafeErrorMessage(err)) as ActionResponse<T>
}
