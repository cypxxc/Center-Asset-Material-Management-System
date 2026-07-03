import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { GET as legacyHealth } from '../../app/api/health/route'
import { GET as readiness } from '../../app/api/health/readiness/route'
import { GET as liveness } from '../../app/api/health/liveness/route'
import { GET as status } from '../../app/api/health/status/route'

test('/api/health reports healthy when services are up', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example-anon-key-with-sufficient-length'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'example-service-role-key-with-sufficient-length'

  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('profiles', [{ id: 'some-id' }])

  const response = await legacyHealth()
  assert.equal(response.status, 200)

  const body = await response.json()
  assert.equal(body.status, 'healthy')
  assert.equal(body.database, 'up')
  assert.equal(body.storage, 'up')
})

test('/api/health reports unhealthy and returns 503 when database is down', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('profiles', null, { message: 'Database unreachable' })

  const response = await legacyHealth()
  assert.equal(response.status, 503)

  const body = await response.json()
  assert.equal(body.status, 'unhealthy')
  assert.equal(body.database, 'down')
})

test('/api/health/readiness returns structured checks', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('profiles', [{ id: 'x' }])

  const response = await readiness()
  const body = await response.json()
  assert.ok('checks' in body)
  assert.ok('database' in body.checks)
  assert.ok('storage' in body.checks)
  assert.ok('environment' in body.checks)
})

test('/api/health/liveness returns alive', async () => {
  const response = await liveness()
  const body = await response.json()
  assert.equal(body.alive, true)
  assert.ok(typeof body.uptime === 'number')
})

test('/api/health/status returns runtime metadata', async () => {
  const response = await status()
  const body = await response.json()
  assert.ok(body.version)
  assert.ok(body.node?.version)
  assert.ok(body.memory?.heapUsed)
})
