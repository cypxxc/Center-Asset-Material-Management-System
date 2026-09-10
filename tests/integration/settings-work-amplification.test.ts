import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mockSupabaseRegistry } from '../mocks/supabase'
const load = createRequire(`${process.cwd()}/package.json`)
let profileReads = 0
let limitedProfile: unknown
const audit: Record<string, unknown>[] = []
const profile = { id: 'staff', role: 'staff', is_active: true }
for (const [path, exports] of [
  ['./features/auth/queries', { getCurrentProfile: async () => { profileReads++; return profile } }],
  ['./lib/rate-limit', { checkRateLimit: async (_action: string, _limit: number, _window: number, verified: unknown) => { limitedProfile = verified; return { success: true } } }],
  ['./lib/audit', { writeAuditLog: async (payload: Record<string, unknown>) => { audit.push(payload) } }],
] as const) {
  const id = load.resolve(path)
  load.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
const { createCategory } = load('./features/settings/actions') as typeof import('../../features/settings/actions')
test('metadata creation reuses authorization for rate limit and logging, with database-owned audit persistence', async () => {
  mockSupabaseRegistry.setTableResponse('categories', [{ id: 'category' }])
  const form = new FormData()
  form.set('name', 'Test'); form.set('is_active', 'on')
  await assert.rejects(createCategory(form), /NEXT_REDIRECT/)
  assert.equal(profileReads, 1)
  assert.equal(limitedProfile, profile)
  assert.equal(audit.length, 1)
  assert.equal(audit[0].userId, 'staff')
  assert.equal(audit[0].persistToDatabase, false)
})
