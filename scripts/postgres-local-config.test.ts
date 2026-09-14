import assert from 'node:assert/strict'
import test from 'node:test'
import { localPostgresConfig, withoutSupabase } from './postgres-local-config'

const valid = { POSTGRES_USER: 'camms_local', POSTGRES_PASSWORD: 'a-long-test-password', POSTGRES_DB: 'camms_local', POSTGRES_PORT: '55432' }

test('local PostgreSQL config uses loopback and encodes credentials', () => {
  const config = localPostgresConfig({ ...valid, POSTGRES_PASSWORD: 'password@with:/symbols' })
  const url = new URL(config.connectionString)
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal(url.port, '55432')
  assert.equal(decodeURIComponent(url.password), 'password@with:/symbols')
})

test('local test refuses invalid ports and missing credentials', () => {
  for (const port of ['0', '65536', '5432/evil', '', '54.3']) {
    assert.throws(() => localPostgresConfig({ ...valid, POSTGRES_PORT: port }))
  }
  assert.throws(() => localPostgresConfig({ ...valid, POSTGRES_PASSWORD: '' }))
})

test('local test refuses URL overrides and nonlocal hosts', () => {
  assert.throws(() => localPostgresConfig({ ...valid, DATABASE_URL: 'postgres://remote/db' }))
  assert.throws(() => localPostgresConfig({ ...valid, PGHOST: 'remote' }))
})

test('isolated test strips Supabase and inherited PostgreSQL configuration', () => {
  const env = withoutSupabase({ PATH: 'keep', NEXT_PUBLIC_SUPABASE_URL: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'secret', DATABASE_URL: 'remote', PGHOST: 'remote' })
  assert.deepEqual(env, { PATH: 'keep' })
})
