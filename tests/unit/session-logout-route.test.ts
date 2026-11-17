import test from 'node:test'
import assert from 'node:assert/strict'
let deletedSessions = 0
const sessionPath = require.resolve('../../lib/postgres/session')
require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: {
  SESSION_COOKIE: 'camms_session',
  deleteSession: async () => { deletedSessions++ },
} } as NodeJS.Module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../../app/api/auth/logout/route') as typeof import('../../app/api/auth/logout/route')

test('timeout logout revokes session, clears HttpOnly cookie and preserves the browser IP and port', async () => {
  const response = await GET()
  assert.equal(deletedSessions, 1)
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), '/login?reason=idle_timeout')
  assert.match(response.headers.get('set-cookie') ?? '', /camms_session=;/)
  assert.match(response.headers.get('set-cookie') ?? '', /Expires=Thu, 01 Jan 1970/)
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
})
