import { test } from 'node:test'
import assert from 'node:assert'
import { createServiceRoleClient, createAdminClient } from '@/lib/supabase/server'

test('createServiceRoleClient initializes client without throwing', () => {
  // Ensure basic env variables are defined for the factory
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-long-value-for-testing'

  const client = createServiceRoleClient()
  assert.ok(client)
})

test('createAdminClient throws outside request context', async () => {
  // Ensure basic env variables are defined for the factory
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-long-value-for-testing'

  await assert.rejects(async () => {
    await createAdminClient()
  })
})
