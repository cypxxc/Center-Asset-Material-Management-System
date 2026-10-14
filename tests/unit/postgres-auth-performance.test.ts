import test, { describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

try {
  const filename = require.resolve('server-only')
  require.cache[filename] = { id: filename, filename, loaded: true, exports: {} } as NodeJS.Module
} catch {
  // Ignored
}
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { hashPassword, SCRYPT_CONFIG } from '../../lib/postgres/password'

describe('PostgreSQL Authentication Concurrency and Locking', () => {
  const queries: { sql: string; params: unknown[] }[] = []
  let profileRowResult: Record<string, unknown>[] = []
  let credentialRowResult: Record<string, unknown>[] = []
  let activeCheckRowResult: Record<string, unknown>[] = []

  function mockModule(path: string, exports: unknown) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }

  const tx = {
    execute: async (query: SQL) => {
      const statement = new PgDialect().sqlToQuery(query)
      queries.push(statement)

      if (statement.sql.includes('from public.profiles') && statement.sql.includes('limit 2')) {
        return { rows: profileRowResult }
      }
      if (statement.sql.includes('from private_auth.credentials') && statement.sql.includes('for update')) {
        return { rows: credentialRowResult }
      }
      if (statement.sql.includes('from public.profiles') && statement.sql.includes('and is_active=true limit 1')) {
        return { rows: activeCheckRowResult }
      }
      if (statement.sql.includes('insert into private_auth.sessions')) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }

  mockModule('../../lib/postgres/db', {
    getAuthDatabase: () => ({
      transaction: async <T>(work: (t: typeof tx) => Promise<T>) => work(tx),
    }),
  })

  beforeEach(() => {
    queries.length = 0
    profileRowResult = []
    credentialRowResult = []
    activeCheckRowResult = []
  })

  test('authenticatePassword does NOT acquire exclusive lock on public.profiles during password verification', async () => {
    const testUserId = '11111111-2222-3333-4444-555555555555'
    const password = 'CorrectPassword123!'
    const hashed = await hashPassword(password)

    profileRowResult = [{ id: testUserId, is_active: true }]
    credentialRowResult = [{ password_hash: hashed }]
    activeCheckRowResult = [{ is_active: true }]

    const { authenticatePassword } = await import('../../lib/postgres/session')
    const session = await authenticatePassword('user@example.com', password)

    assert.ok(session, 'Should produce a valid session')
    assert.equal(session.token.length, 64)

    // Check queries executed
    const profileLookup = queries.find(q => q.sql.includes('from public.profiles') && q.sql.includes('limit 2'))
    assert.ok(profileLookup, 'Must execute profile lookup')
    assert.ok(!profileLookup.sql.includes('for update'), 'Profile query MUST NOT contain FOR UPDATE to avoid contention')

    const credentialQuery = queries.find(q => q.sql.includes('from private_auth.credentials'))
    assert.ok(credentialQuery, 'Must query credentials')
    assert.ok(credentialQuery.sql.includes('for update'), 'Credentials query MUST hold FOR UPDATE to serialize password mutations')

    const activeCheckQuery = queries.find(q => q.sql.includes('and is_active=true limit 1'))
    assert.ok(activeCheckQuery, 'Must verify active status before issuing session')
  })

  test('authenticatePassword rejects when account was deactivated concurrently', async () => {
    const testUserId = '11111111-2222-3333-4444-555555555555'
    const password = 'CorrectPassword123!'
    const hashed = await hashPassword(password)

    // Profile originally active
    profileRowResult = [{ id: testUserId, is_active: true }]
    credentialRowResult = [{ password_hash: hashed }]
    // Concurrently deactivated!
    activeCheckRowResult = []

    const { authenticatePassword } = await import('../../lib/postgres/session')
    const session = await authenticatePassword('user@example.com', password)

    assert.equal(session, null, 'Must reject deactivated user session')
  })

  test('SCRYPT_CONFIG is exported and specifies proper security parameters', () => {
    assert.equal(SCRYPT_CONFIG.cost, 16384)
    assert.equal(SCRYPT_CONFIG.blockSize, 8)
    assert.equal(SCRYPT_CONFIG.parallelization, 1)
    assert.equal(SCRYPT_CONFIG.keylen, 64)
  })
})
