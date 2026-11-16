import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getReadinessConnectionString } from './verify-database-readiness'

test('readiness loads activated local settings with environment and migration URL precedence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'camms-readiness-'))
  try {
    writeFileSync(join(directory, '.env.local'), 'DATABASE_URL="postgres://app:local@localhost/registry"\n')
    writeFileSync(join(directory, '.env'), 'DATABASE_URL=postgres://app:fallback@localhost/registry\n')
    assert.equal(getReadinessConnectionString({}, directory), 'postgres://app:local@localhost/registry')
    assert.equal(getReadinessConnectionString({ DATABASE_URL: 'postgres://app:runtime@localhost/registry' }, directory), 'postgres://app:runtime@localhost/registry')
    assert.equal(getReadinessConnectionString({ DATABASE_MIGRATION_URL: 'postgres://owner:migrate@localhost/registry' }, directory), 'postgres://owner:migrate@localhost/registry')
    writeFileSync(join(directory, '.env.local'), '# no local override\n')
    assert.equal(getReadinessConnectionString({}, directory), 'postgres://app:fallback@localhost/registry')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('readiness requires real connection settings even in CI', () => {
  const directory = mkdtempSync(join(tmpdir(), 'camms-readiness-'))
  try {
    assert.throws(() => getReadinessConnectionString({ CI: 'true' }, directory), /Set DATABASE_URL or DATABASE_MIGRATION_URL/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
