export const REQUEST_ID_HEADER = 'x-request-id'
export const CORRELATION_ID_HEADER = 'x-correlation-id'
export const TRACE_ID_HEADER = 'x-trace-id'

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ensureTraceHeaders(headers: Headers): {
  requestId: string
  correlationId: string
  traceId: string
} {
  let requestId = headers.get(REQUEST_ID_HEADER)
  if (!requestId) {
    requestId = generateId()
    headers.set(REQUEST_ID_HEADER, requestId)
  }

  let correlationId = headers.get(CORRELATION_ID_HEADER)
  if (!correlationId) {
    correlationId = requestId
    headers.set(CORRELATION_ID_HEADER, correlationId)
  }

  let traceId = headers.get(TRACE_ID_HEADER)
  if (!traceId) {
    traceId = generateId()
    headers.set(TRACE_ID_HEADER, traceId)
  }

  return { requestId, correlationId, traceId }
}

export function setTraceResponseHeaders(
  responseHeaders: Headers,
  ids: { requestId: string; correlationId: string; traceId: string },
): void {
  responseHeaders.set(REQUEST_ID_HEADER, ids.requestId)
  responseHeaders.set(CORRELATION_ID_HEADER, ids.correlationId)
  responseHeaders.set(TRACE_ID_HEADER, ids.traceId)
}
