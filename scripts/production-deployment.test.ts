import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

test('production secrets admit restricted roles and reject owner credentials and mismatched databases', async () => {
  const { runtimeConnections } = await import('../deploy/runtime-config.mjs')
  const valid = 'DATABASE_URL=postgresql://camms_app:fixture@postgres:5432/camms_registry\nDATABASE_AUTH_URL=postgresql://camms_auth:fixture@postgres:5432/camms_registry'
  assert.equal(Object.keys(runtimeConnections(valid)).length, 2)
  assert.throws(() => runtimeConnections(valid + '\nDATABASE_MIGRATION_URL=postgresql://owner:fixture@postgres/registry'), /unexpected key/)
  assert.throws(() => runtimeConnections(valid + '\nconstructor=unexpected'), /unexpected key/)
  assert.throws(() => runtimeConnections(valid.replace('camms_app:', 'camms_local:')), /restricted/)
  assert.throws(() => runtimeConnections(valid.replace('camms_auth:fixture@postgres', 'camms_auth:fixture@other')), /same database/)
  assert.throws(() => runtimeConnections(valid.replace('camms_app:fixture', 'camms_app:')), /restricted/)
})

test('deployment preserves external database and excludes secrets from Docker context', () => {
  const compose = readFileSync('compose.production.yaml', 'utf8')
  assert.match(compose, /external: true/)
  assert.match(compose, /camms-postgres-local_default/)
  assert.doesNotMatch(compose, /image: postgres:|postgres_data:|DATABASE_MIGRATION_URL/)
  assert.match(compose, /create_host_path: false/)
  assert.match(compose, /restart: unless-stopped/)
  const ignore = readFileSync('.dockerignore', 'utf8').split(/\r?\n/)
  for (const path of ['.env*', '**/.env*', '.local-storage', '.cache', 'backups', '.git']) assert(ignore.includes(path), `${path} must stay outside build context`)
  const dockerfile = readFileSync('Dockerfile', 'utf8')
  assert.match(dockerfile, /RUN npm ci/)
  assert.match(dockerfile, /USER camms/)
  assert.doesNotMatch(dockerfile, /ARG DATABASE|ENV DATABASE/)
  assert.match(readFileSync('deploy/Caddyfile.internal', 'utf8'), /skip_install_trust/)
})

test('preparation creates separate restricted config without overwriting source or existing deployment', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'camms-production-'))
  const script = resolve('scripts/prepare-production.ts')
  const initial = 'DATABASE_URL=postgresql://camms_app:fixture@127.0.0.1:15432/camms_registry\nDATABASE_AUTH_URL=postgresql://camms_auth:fixture@127.0.0.1:15432/camms_registry\nDATABASE_MIGRATION_URL=postgresql://owner:owner-secret@127.0.0.1:15432/camms_registry\nLOCAL_STORAGE_PATH=./uploads\n'
  try {
    mkdirSync(join(fixture, 'uploads'))
    writeFileSync(join(fixture, '.env.postgres.app'), initial)
    const run = () => spawnSync(process.execPath, ['--import', pathToFileURL(require.resolve('tsx')).href, script, '--site', 'localhost', '--tls', 'internal', '--https-port', '8443'], { cwd: fixture, encoding: 'utf8' })
    const first = run()
    assert.equal(first.status, 0, first.stderr)
    const secret = readFileSync(join(fixture, '.env.production.runtime'), 'utf8')
    assert(secret.includes('@postgres:5432/camms_registry'))
    assert(!secret.includes('owner'))
    const config = readFileSync(join(fixture, '.env.production.compose'), 'utf8')
    assert(config.includes('127.0.0.1'))
    assert(!config.includes('fixture@'))
    assert.equal(readFileSync(join(fixture, '.env.postgres.app'), 'utf8'), initial)
    assert.equal(run().status, 1)
    assert.equal(readFileSync(join(fixture, '.env.production.runtime'), 'utf8'), secret)
  } finally {
    assert(fixture.startsWith(join(tmpdir(), 'camms-production-')))
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('PostgreSQL CI executes setup, fresh migrations, security, live integration and browser gates', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8').split('  postgres-release:')[1]?.split('  staging-release:')[0]
  assert(workflow)
  for (const step of ['npm run postgres:up', 'npm run postgres:app:setup', 'POSTGRES_ADMIN_LIVE_TEST', 'POSTGRES_QUERY_INTEGRATION', 'npm run postgres:verify:security', 'npm run postgres:verify:browser', 'npm run postgres:verify:http', 'docker build']) assert(workflow.includes(step), `Missing PostgreSQL CI gate: ${step}`)
  assert(!workflow.includes('SUPABASE'))
})
