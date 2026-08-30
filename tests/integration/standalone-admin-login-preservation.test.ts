import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'

process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'

test('an admin-created staff account keeps its assigned role and accepts only its own password', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'admin-user', email: 'admin@example.com' },
    { id: 'admin-user', email: 'admin@example.com', role: 'admin', is_active: true },
  )
  mockSupabaseRegistry.setTableResponseForClient('profiles', 'service', [])
  const { createAuthUser } = await import('../../features/admin/actions')

  const result = await createAuthUser({
    email: 'new-user@example.com',
    password: 'password-123',
    full_name: 'New User',
    role: 'staff',
    is_active: true,
  })

  assert.equal(result.success, true, JSON.stringify(result))
  assert.deepEqual(mockSupabaseRegistry.getAuthAdminLog(), [
    {
      operation: 'createUser',
      payload: {
        email: 'new-user@example.com',
        password: 'password-123',
        email_confirm: true,
        user_metadata: {
          full_name: 'New User',
          role: 'staff',
          is_active: true,
        },
      },
    },
  ])
  const profileUpsert = mockSupabaseRegistry
    .getServiceQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations[0]?.[0] === 'upsert')
  assert.ok(profileUpsert)
  const upsertRows = profileUpsert.operations[0]?.[1] as Array<Record<string, unknown>>
  assert.equal(upsertRows[0]?.email, 'new-user@example.com')
  assert.equal(upsertRows[0]?.role, 'staff')
  assert.equal(upsertRows[0]?.is_active, true)

  const { login } = await import('../../features/auth/actions')
  const wrongPassword = new FormData()
  wrongPassword.set('id', 'new-user@example.com')
  wrongPassword.set('password', 'wrong-password')
  const rejectedLogin = await login(null, wrongPassword)
  assert.match(rejectedLogin.error ?? '', /ไม่ถูกต้อง|ข้อผิดพลาด/)

  const formData = new FormData()
  formData.set('id', 'new-user@example.com')
  formData.set('password', 'password-123')

  await assert.rejects(
    login(null, formData),
    (error: unknown) => {
      const redirectError = error as Error & { digest?: string }
      return redirectError.message === 'NEXT_REDIRECT'
        && redirectError.digest?.includes('/dashboard') === true
    },
  )

  const linkedAuth = mockSupabaseRegistry.getAuth()
  assert.equal(linkedAuth.user?.email, 'new-user@example.com')
  assert.equal(linkedAuth.profile?.email, 'new-user@example.com')
  assert.equal(linkedAuth.profile?.role, 'staff')
  assert.equal(linkedAuth.profile?.is_active, true)
})
