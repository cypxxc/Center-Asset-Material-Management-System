import '../setup/server-only'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const loadModule = createRequire(`${process.cwd()}/package.json`)

let requestHeaders = new Headers({ 'x-forwarded-for': '192.0.2.1' })
const headersPath = require.resolve('next/headers')
loadModule(headersPath)
require.cache[headersPath]!.exports = { ...require.cache[headersPath]!.exports, headers: async () => requestHeaders }
const authPath = require.resolve('../../features/auth/queries')
loadModule(authPath)
let profile: { id: string } | null = null
require.cache[authPath]!.exports = { getCurrentProfile: async () => profile }
const serverPath = require.resolve('../../lib/supabase/server')
const keys: string[] = []
let response: unknown = { success: true, remaining: 0, reset: Date.now() + 60000 }
let failure = false
require.cache[serverPath]!.exports = { createServiceRoleClient: () => ({ rpc: (_name: string, args: { bucket_key: string }) => ({
  abortSignal: async () => {
    keys.push(args.bucket_key)
    if (failure) throw new Error('offline')
    return { data: response, error: null }
  },
}) }) }
const { checkRateLimit } = loadModule('./lib/rate-limit') as typeof import('../../lib/rate-limit')

test('request limiter cannot be reset by changing user IP or login session', async () => {
  process.env.TRUSTED_PROXY_MODE = 'forwarded'
  process.env.TRUSTED_PROXY_HOPS = '1'
  profile = { id: 'user-1' }
  assert.equal((await checkRateLimit('updateItem', 1)).success, true)
  requestHeaders = new Headers({ 'x-forwarded-for': '192.0.2.2' })
  await checkRateLimit('updateItem', 1)
  assert.equal(keys[0], keys[1])
  await checkRateLimit('login', 1)
  profile = { id: 'user-2' }
  await checkRateLimit('login', 1)
  assert.equal(keys[2], keys[3])
  profile = null
  const missingProfileCount = keys.length
  assert.equal((await checkRateLimit('updatePersonalPassword')).success, false)
  assert.equal(keys.length, missingProfileCount)
  failure = true
  assert.equal((await checkRateLimit('login')).success, false)
  failure = false
  response = null
  assert.equal((await checkRateLimit('login')).success, false)
  response = { success: false, remaining: 0, reset: Date.now() + 60000 }
  assert.equal((await checkRateLimit('login')).success, false)
  requestHeaders = new Headers({ 'x-forwarded-for': 'invalid' })
  const before = keys.length
  assert.equal((await checkRateLimit('login')).success, false)
  assert.equal(keys.length, before)
})
