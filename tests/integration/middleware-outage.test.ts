import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { NextRequest } from 'next/server'
import { config } from '../../lib/config'
import { updateSession } from '../../lib/supabase/middleware'

test('Auth refresh outage returns promptly without clearing the session', async () => {
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    // Release the old implementation too, so a failing regression cannot hang.
    setTimeout(() => { response.writeHead(400); response.end('{}') }, 700)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only'
  const limits = config.limits as unknown as { supabaseAuthTimeoutMs: number }
  const original = limits.supabaseAuthTimeoutMs
  limits.supabaseAuthTimeoutMs = 200
  const session = Buffer.from(JSON.stringify({
    access_token: 'expired-test-token', refresh_token: 'test-only-refresh',
    expires_at: 1, expires_in: 1, token_type: 'bearer', user: { id: 'test-only' },
  })).toString('base64url')
  try {
    const start = performance.now()
    const response = await updateSession(new NextRequest('http://localhost/dashboard', {
      headers: { cookie: `sb-127-auth-token=base64-${session}` },
    }))
    assert.equal(response.status, 503)
    assert.ok(performance.now() - start < 600)
    assert.ok(requests > 0)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('retry-after'), '15')
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    const login = await updateSession(new NextRequest('http://localhost/login'))
    assert.equal(login.status, 200)
    const protectedPage = await updateSession(new NextRequest('http://localhost/dashboard'))
    assert.equal(protectedPage.status, 307)
    assert.equal(new URL(protectedPage.headers.get('location')!).pathname, '/login')
  } finally {
    limits.supabaseAuthTimeoutMs = original
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('Auth 504 is a retryable outage while invalid credentials redirect to login', async () => {
  let status = 504
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ message: 'Auth unavailable' }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only'
  const session = Buffer.from(JSON.stringify({
    access_token: `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'test-only', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.dGVzdA`, refresh_token: 'test-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer', user: { id: 'test-only' },
  })).toString('base64url')
  try {
    const request = () => new NextRequest('http://localhost/dashboard', {
      headers: { cookie: `sb-127-auth-token=base64-${session}` },
    })
    const outage = await updateSession(request())
    assert.equal(outage.status, 503)
    assert.equal(outage.headers.get('set-cookie'), null)
    status = 401
    assert.equal((await updateSession(request())).status, 307)
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
