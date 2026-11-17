import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePersonalEmail } from '../../features/auth/personal-email'

test('accepts and normalizes a real email', () => {
  assert.equal(parsePersonalEmail(' User@Example.com '), 'user@example.com')
})

test('rejects missing, malformed, oversized and internal emails', () => {
  for (const value of [null, '', 'invalid', 'a@registry.internal', 'A@REGISTRY.INTERNAL', `${'a'.repeat(250)}@example.com`]) {
    assert.equal(parsePersonalEmail(value), null)
  }
})
