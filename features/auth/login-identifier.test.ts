import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveUniqueProfileEmail } from './login-identifier'

test('name login resolves exactly one profile email', () => {
  assert.equal(resolveUniqueProfileEmail([{ email: 'staff@example.com' }]), 'staff@example.com')
})

test('name login rejects absent, missing-email, and ambiguous profiles', () => {
  assert.equal(resolveUniqueProfileEmail([]), null)
  assert.equal(resolveUniqueProfileEmail([{ email: null }]), null)
  assert.equal(resolveUniqueProfileEmail([
    { email: 'first@example.com' }, { email: 'second@example.com' },
  ]), null)
})
