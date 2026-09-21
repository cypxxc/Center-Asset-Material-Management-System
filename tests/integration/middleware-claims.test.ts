import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { generateKeyPairSync, sign } from 'node:crypto'
import { NextRequest } from 'next/server'
import { updateSession } from '../../lib/supabase/middleware'

test('proxy verifies signed tokens with cached public keys without a user lookup', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'ES256', use: 'sig' }
  let userCalls = 0
  let keyCalls = 0
  let userStatus = 200
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.url?.endsWith('/.well-known/jwks.json')) {
      keyCalls++
      response.end(JSON.stringify({ keys: [jwk] }))
    } else {
      userCalls++
      response.writeHead(userStatus)
      response.end(JSON.stringify(userStatus === 200 ? { id: 'test-user' } : { message: 'Session revoked' }))
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only'
  const exp = Math.floor(Date.now() / 1000) + 3600
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = `${encode({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })}.${encode({ sub: 'test-user', exp, iat: exp - 3600, role: 'authenticated' })}`
  const signature = sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  const request = (token: string, path = '/dashboard') => new NextRequest(`http://localhost${path}`, {
    headers: { cookie: `sb-127-auth-token=base64-${encode({ access_token: token, refresh_token: 'test-only', expires_at: exp, token_type: 'bearer', user: { id: 'test-user' } })}` },
  })
  try {
    const token = `${payload}.${signature}`
    assert.equal((await updateSession(request(token))).status, 200)
    assert.equal((await updateSession(request(token))).status, 200)
    assert.equal(userCalls, 0, 'verified JWTs do not require remote getUser in proxy')
    assert.equal(keyCalls, 1, 'the SDK reuses cached public keys')
    const login = await updateSession(request(token, '/login'))
    assert.equal(login.status, 307)
    assert.equal(new URL(login.headers.get('location')!).pathname, '/dashboard')
    userStatus = 401
    const revokedLogin = await updateSession(request(token, '/login'))
    assert.equal(revokedLogin.status, 200, 'a signed token with a revoked session must allow logging in again')
    assert.equal(revokedLogin.headers.get('location'), null)
    const forged = await updateSession(request(`${payload}.${Buffer.alloc(64).toString('base64url')}`))
    assert.notEqual(forged.status, 200, 'forged signatures never pass authentication')
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
