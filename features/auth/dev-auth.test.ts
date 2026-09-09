import '../../tests/setup/server-only'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server'
const load = createRequire(`${process.cwd()}/package.json`)
let user: { id: string } | null = null
let active = true
let authError: Error | null = null
let selectedId: unknown
let hasForgedCookie = true
const forged = JSON.stringify({ id: 'forged-admin', email: 'admin@example.com', role: 'admin' })
const client = {
  auth: { getUser: async () => ({ data: { user }, error: authError }) },
  from: () => ({ select: () => ({ eq: (_key: string, id: unknown) => {
    selectedId = id
    return { single: async () => ({ data: { id, role: 'staff', is_active: active }, error: null }), maybeSingle: async () => ({ data: { id, role: 'admin', is_active: active }, error: null }) }
  } }) }),
}
for (const [name, exports] of [
  ['@supabase/ssr', { createServerClient: () => client }],
  ['next/headers', { cookies: async () => ({ get: () => hasForgedCookie ? { value: forged } : undefined, getAll: () => hasForgedCookie ? [{ name: 'registry-dev-auth', value: forged }] : [] }) }],
] as const) {
  const id = load.resolve(name)
  load.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
const { getCurrentProfile } = load('./features/auth/queries') as typeof import('./queries')
const { updateSession } = load('./lib/supabase/middleware') as typeof import('../../lib/supabase/middleware')
function request(cookie: boolean) {
  return new NextRequest('https://example.com/dashboard', { headers: cookie ? { cookie: `registry-dev-auth=${encodeURIComponent(forged)}` } : {} })
}
test('real profile query and proxy reject missing sessions and forged development cookies', async () => {
  for (const cookie of [false, true]) {
    hasForgedCookie = cookie
    user = null
    assert.equal(await getCurrentProfile(), null)
    const result = await updateSession(request(cookie))
    assert.equal(new URL(result.headers.get('location')!).pathname, '/login')
  }
})
test('verified Supabase session determines profile despite forged administrator cookie', async () => {
  user = { id: 'verified-staff' }
  assert.equal((await getCurrentProfile())?.id, user.id)
  assert.equal(selectedId, user.id)
  assert.equal((await updateSession(request(true))).headers.get('location'), null)
})
test('inactive profiles and auth errors confer no profile', async () => {
  user = { id: 'verified-staff' }
  active = false
  assert.equal(await getCurrentProfile(), null)
  active = true
  authError = new Error('Invalid session')
  assert.equal(await getCurrentProfile(), null)
  assert.equal(new URL((await updateSession(request(true))).headers.get('location')!).pathname, '/login')
})
