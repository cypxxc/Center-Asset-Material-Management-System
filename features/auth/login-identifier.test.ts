import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveUniqueProfileEmail, resolveUniqueProfileCandidate, classifyLoginIdentifier } from './login-identifier'
import { generateInternalEmail, isInternalEmail } from '@/lib/display-email'

test('classifyLoginIdentifier categorizes email, uuid, and name', () => {
  assert.equal(classifyLoginIdentifier('user@example.com'), 'email')
  assert.equal(classifyLoginIdentifier('  admin@domain.org  '), 'email')
  assert.equal(classifyLoginIdentifier('550e8400-e29b-41d4-a716-446655440000'), 'uuid')
  assert.equal(classifyLoginIdentifier('  550e8400-e29b-41d4-a716-446655440000  '), 'uuid')
  assert.equal(classifyLoginIdentifier('Somchai Prasert'), 'name')
  assert.equal(classifyLoginIdentifier('admin'), 'name')
})

test('generateInternalEmail creates valid internal email placeholder', () => {
  const email1 = generateInternalEmail()
  const email2 = generateInternalEmail()
  assert.ok(isInternalEmail(email1))
  assert.ok(isInternalEmail(email2))
  assert.notEqual(email1, email2)
  assert.match(email1, /^internal\+[0-9a-f]{8}@registry\.internal$/)
})

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

test('resolveUniqueProfileCandidate returns email and is_active for valid candidate', () => {
  assert.deepEqual(resolveUniqueProfileCandidate([{ email: 'staff@example.com', is_active: true }]), {
    email: 'staff@example.com',
    is_active: true,
  })
  assert.deepEqual(resolveUniqueProfileCandidate([{ email: 'inactive@example.com', is_active: false }]), {
    email: 'inactive@example.com',
    is_active: false,
  })
  assert.deepEqual(resolveUniqueProfileCandidate([{ email: 'default@example.com' }]), {
    email: 'default@example.com',
    is_active: true,
  })
})

test('resolveUniqueProfileCandidate rejects invalid candidate rows', () => {
  assert.equal(resolveUniqueProfileCandidate([]), null)
  assert.equal(resolveUniqueProfileCandidate([{ email: null, is_active: true }]), null)
  assert.equal(resolveUniqueProfileCandidate([
    { email: 'first@example.com', is_active: true },
    { email: 'second@example.com', is_active: true },
  ]), null)
})

