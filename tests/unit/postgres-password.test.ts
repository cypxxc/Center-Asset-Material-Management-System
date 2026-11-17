import test from 'node:test'
import assert from 'node:assert/strict'
import { hashSync } from 'bcryptjs'
import { hashPassword, verifyPassword } from '../../lib/postgres/password'

test('verifies DB-compatible bcrypt without weakening existing scrypt passwords', async () => {
  const encoded = hashSync('navicat-password', 12)
  assert.equal(await verifyPassword('navicat-password', encoded), true)
  assert.equal(await verifyPassword('wrong-password', encoded), false)
  const legacy = await hashPassword('existing-password')
  assert.equal(await verifyPassword('existing-password', legacy), true)
  assert.equal(await verifyPassword('wrong-password', legacy), false)
})

test('rejects bcrypt truncation, malformed hashes, and excessive work factors', async () => {
  const encoded = hashSync('a'.repeat(72), 12)
  assert.equal(await verifyPassword('a'.repeat(72), encoded), true)
  assert.equal(await verifyPassword('a'.repeat(73), encoded), false)
  assert.equal(await verifyPassword('ร'.repeat(25), encoded), false)
  assert.equal(await verifyPassword('password', '$2a$31$' + 'a'.repeat(53)), false)
  assert.equal(await verifyPassword('password', '$2a$12$bad'), false)
})
