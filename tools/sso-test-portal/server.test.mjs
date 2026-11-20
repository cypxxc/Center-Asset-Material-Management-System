import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

test('portal issues single-use authorization code and signed JWT', async () => {
  const secret = randomBytes(32).toString('hex')
  const clientSecret = randomBytes(32).toString('hex')
  const child = spawn(process.execPath, ['tools/sso-test-portal/server.mjs'], {
    env: { ...process.env, SSO_JWT_SECRET: secret, SSO_LOCAL_TEST_CLIENT_SECRET: clientSecret, SSO_LOCAL_TEST_SUBJECT: 'test-user' },
    stdio: 'ignore',
  })
  try {
    let ready = false
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch('http://127.0.0.1:3001/')).ok; if (ready) break } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, 'portal started')
    const login = await fetch('http://127.0.0.1:3001/login', { method: 'POST', redirect: 'manual' })
    assert.equal(login.status, 303)
    const code = new URL(login.headers.get('location')).searchParams.get('code')
    const exchange = () => fetch('http://127.0.0.1:3001/exchange', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-client-secret': clientSecret },
      body: JSON.stringify({ code }),
    })
    const unauthorized = await fetch('http://127.0.0.1:3001/exchange', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-client-secret': 'wrong' },
      body: JSON.stringify({ code }),
    })
    assert.equal(unauthorized.status, 403)
    const first = await exchange()
    assert.equal(first.status, 200)
    const { token } = await first.json()
    const [header, payload, sig] = token.split('.')
    assert.equal(createHmac('sha256', secret).update(header + '.' + payload).digest('base64url'), sig)
    assert.equal(JSON.parse(Buffer.from(payload, 'base64url')).sub, 'test-user')
    assert.equal((await exchange()).status, 400)
  } finally { child.kill() }
})
