import test from 'node:test'
import assert from 'node:assert/strict'
let deletedSessions = 0
const sessionPath = require.resolve('../../lib/postgres/session')
require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: {
  SESSION_COOKIE: 'camms_session',
  deleteSession: async () => { deletedSessions++ },
} } as NodeJS.Module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, POST } = require('../../app/api/auth/logout/route') as typeof import('../../app/api/auth/logout/route')

test('GET logout is rejected with 405 without revoking session', async () => {
  deletedSessions = 0
  const response = await GET()
  assert.equal(deletedSessions, 0)
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'POST')
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
})

test('POST logout revokes session and clears HttpOnly cookie for same-origin requests', async () => {
  deletedSessions = 0
  const request = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' },
  })
  const response = await POST(request)
  assert.equal(deletedSessions, 1)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie') ?? '', /camms_session=;/)
  assert.match(response.headers.get('set-cookie') ?? '', /Expires=Thu, 01 Jan 1970/)
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
})

test('POST logout rejects cross-origin CSRF attempts with 403', async () => {
  deletedSessions = 0
  const request = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { host: 'localhost:3000', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
  })
  const response = await POST(request)
  assert.equal(deletedSessions, 0)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
})
