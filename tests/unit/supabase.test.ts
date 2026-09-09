import '../setup/server-only'
import { test } from 'node:test'
import assert from 'node:assert'
import { createServiceRoleClient } from '@/lib/supabase/server'

test('createServiceRoleClient initializes client without throwing', () => {
  // Ensure basic env variables are defined for the factory
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-long-value-for-testing'

  const client = createServiceRoleClient()
  assert.ok(client)
  const auth = client.auth as unknown as { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean }
  assert.equal(auth.persistSession, false)
  assert.equal(auth.autoRefreshToken, false)
  assert.equal(auth.detectSessionInUrl, false)
})

test('createServiceRoleClient creates a cookie-independent service-role client', async () => {
  // Ensure basic env variables are defined for the factory
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-long-value-for-testing'

  const client = await createServiceRoleClient()
  assert.ok(client)
  const auth = client.auth as unknown as { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean }
  assert.equal(auth.persistSession, false)
  assert.equal(auth.autoRefreshToken, false)
  assert.equal(auth.detectSessionInUrl, false)
})
