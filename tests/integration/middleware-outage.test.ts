import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { NextRequest } from 'next/server'
import { config } from '../../lib/config'

test('real Supabase SDK refresh cannot hold navigation open during an Auth outage', async () => {
  let requests = 0
  const server = createServer(() => { requests++ })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
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
    const { updateSession } = await import('../../lib/supabase/middleware')
    const start = performance.now()
    const response = await updateSession(new NextRequest('http://localhost/dashboard', {
      headers: { cookie: `sb-127-auth-token=base64-${session}` },
    }))
    assert.equal(response.status, 503)
    assert.ok(performance.now() - start < 1500)
    assert.ok(requests > 0, 'SDK attempted the real HTTP refresh')
    assert.equal(response.headers.get('set-cookie'), null)
  } finally {
    limits.supabaseAuthTimeoutMs = original
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
