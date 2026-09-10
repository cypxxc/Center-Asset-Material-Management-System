import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'

type Cookie = { name: string; value: string; options?: CookieOptions }
let claimsResult: { data: { claims: { sub?: string } } | null; error: Error | null }
let cookiesToSet: Cookie[] = []
let clientCalls = 0
let claimsCalls = 0
const refreshHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}
const ssrPath = require.resolve('@supabase/ssr')
require.cache[ssrPath] = {
  id: ssrPath, filename: ssrPath, loaded: true,
  exports: {
    createServerClient: (_url: string, _key: string, options: {
      cookies: { setAll(cookies: Cookie[], headers: Record<string, string>): void }
    }) => {
      clientCalls++
      return { auth: { getClaims: async () => {
        claimsCalls++
        if (cookiesToSet.length) options.cookies.setAll(cookiesToSet, refreshHeaders)
        return claimsResult
      } } }
    },
  },
} as NodeJS.Module

test.beforeEach(() => {
  claimsResult = { data: { claims: { sub: 'verified-user' } }, error: null }
  cookiesToSet = []
  clientCalls = 0
  claimsCalls = 0
})

test('verified claims allow protected navigation with one SDK verification', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  const response = await updateSession(new NextRequest('http://localhost/dashboard'))
  assert.equal(response.status, 200)
  assert.equal(claimsCalls, 1)
})

test('absent, invalid, and errored claims cannot enter protected pages', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  for (const result of [
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { data: { claims: { sub: '' } }, error: null },
    { data: { claims: { sub: 'untrusted' } }, error: new Error('Invalid signature') },
    { data: null, error: new Error('JWT expired') },
  ]) {
    claimsResult = result
    const request = new NextRequest('http://localhost/dashboard', {
      headers: { cookie: 'sb-fake-auth-token=unsigned-client-session' },
    })
    const response = await updateSession(request)
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'http://localhost/login')
  }
})

test('refresh cookies and cache protection survive pass-through and login redirects', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  for (const path of ['/dashboard', '/login']) {
    cookiesToSet = [{ name: 'sb-session', value: 'refreshed-token', options: {
      path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600,
    } }]
    const request = new NextRequest(`http://localhost${path}`)
    const response = await updateSession(request)
    assert.equal(request.cookies.get('sb-session')?.value, 'refreshed-token')
    assert.deepEqual(response.cookies.get('sb-session'), {
      name: 'sb-session', value: 'refreshed-token', path: '/', httpOnly: true,
      secure: true, sameSite: 'lax', maxAge: 3600,
      expires: response.cookies.get('sb-session')?.expires,
    })
    assert.equal(response.headers.get('cache-control'), refreshHeaders['Cache-Control'])
    assert.equal(response.headers.get('pragma'), 'no-cache')
    assert.equal(response.headers.get('expires'), '0')
    assert.equal(response.status, path === '/login' ? 307 : 200)
    if (path === '/login') assert.equal(response.headers.get('location'), 'http://localhost/dashboard')
  }
})

test('failed refresh clears stale cookies on the redirect to login', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  claimsResult = { data: null, error: new Error('Refresh token revoked') }
  cookiesToSet = [{ name: 'sb-session', value: '', options: { path: '/', maxAge: 0 } }]
  const response = await updateSession(new NextRequest('http://localhost/items'))
  assert.equal(response.headers.get('location'), 'http://localhost/login')
  assert.equal(response.cookies.get('sb-session')?.maxAge, 0)
  assert.equal(response.cookies.get('sb-session')?.value, '')
  assert.equal(response.headers.get('cache-control'), refreshHeaders['Cache-Control'])
})

test('inactive notice stays on login even with a valid token', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  const response = await updateSession(new NextRequest('http://localhost/login?error=inactive'))
  assert.equal(response.status, 200)
})

test('public assets and API routes never create an auth client', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  for (const path of ['/api/health', '/_next/static/app.js', '/images/logo.svg', '/robots.txt']) {
    assert.equal((await updateSession(new NextRequest(`http://localhost${path}`))).status, 200)
  }
  assert.equal(clientCalls, 0)
  assert.equal(claimsCalls, 0)
})
