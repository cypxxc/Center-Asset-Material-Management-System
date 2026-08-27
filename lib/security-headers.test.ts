import test from 'node:test'
import assert from 'node:assert/strict'
import { SECURITY_HEADERS, applySecurityHeaders } from './security-headers'
import { NextRequest, NextResponse } from 'next/server'

test('SECURITY_HEADERS includes strict OWASP-compliant security headers', () => {
  assert.equal(SECURITY_HEADERS['X-Frame-Options'], 'DENY')
  assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff')
  assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.equal(SECURITY_HEADERS['Cross-Origin-Opener-Policy'], 'same-origin')
  assert.equal(SECURITY_HEADERS['Cross-Origin-Resource-Policy'], 'same-origin')
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'], /max-age=31536000/)
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'], /includeSubDomains/)
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'], /preload/)
  assert.match(SECURITY_HEADERS['Permissions-Policy'], /camera=\(\)/)
  assert.match(SECURITY_HEADERS['Permissions-Policy'], /microphone=\(\)/)
  assert.match(SECURITY_HEADERS['Permissions-Policy'], /geolocation=\(\)/)

  const csp = SECURITY_HEADERS['Content-Security-Policy']
  assert.match(csp, /default-src 'self'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /connect-src/)
})

test('applySecurityHeaders sets all security and trace headers on response', () => {
  const req = new NextRequest('http://localhost:3000/dashboard')
  const res = NextResponse.next()
  const secureRes = applySecurityHeaders(req, res)

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(secureRes.headers.get(key), value)
  }
  assert.ok(secureRes.headers.get('x-trace-id'))
  assert.ok(secureRes.headers.get('x-request-id'))
})
