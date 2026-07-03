import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensureTraceHeaders, generateId } from '@/lib/tracing/headers'
import { isInternalEmail } from '@/lib/auth/display-email'

test('generateId returns non-empty string', () => {
  assert.ok(generateId().length > 8)
})

test('ensureTraceHeaders propagates request, correlation, and trace IDs', () => {
  const headers = new Headers()
  const ids = ensureTraceHeaders(headers)
  assert.ok(ids.requestId)
  assert.equal(ids.correlationId, ids.requestId)
  assert.ok(ids.traceId)
  assert.equal(headers.get('x-request-id'), ids.requestId)
  assert.equal(headers.get('x-correlation-id'), ids.correlationId)
  assert.equal(headers.get('x-trace-id'), ids.traceId)
})

test('ensureTraceHeaders preserves inbound correlation ID', () => {
  const headers = new Headers({ 'x-correlation-id': 'corr-123' })
  const ids = ensureTraceHeaders(headers)
  assert.equal(ids.correlationId, 'corr-123')
})

// sanity: display-email still works alongside tracing package
test('internal email detection unchanged', () => {
  assert.equal(isInternalEmail('u@registry.internal'), true)
})
