import test from 'node:test'
import assert from 'node:assert/strict'
import { getDevelopmentSeedAccount, isDevelopmentAuthEnabled } from './dev-auth'

test('returns seeded development account for known demo credentials', () => {
  const account = getDevelopmentSeedAccount('admin@registry.s', 'admin1234')
  assert.ok(account)
  assert.equal(account?.email, 'admin@registry.s')
  assert.equal(account?.role, 'admin')
})

test('returns null for unknown credentials', () => {
  const account = getDevelopmentSeedAccount('unknown@example.com', 'wrong-password')
  assert.equal(account, null)
})

test('disables seeded development auth in production', () => {
  const mutableEnv = process.env as Record<string, string | undefined>
  const previousNodeEnv = process.env.NODE_ENV
  mutableEnv.NODE_ENV = 'production'
  try {
    assert.equal(isDevelopmentAuthEnabled(), false)
    assert.equal(getDevelopmentSeedAccount('admin@registry.s', 'admin1234'), null)
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV
    else mutableEnv.NODE_ENV = previousNodeEnv
  }
})
