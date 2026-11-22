import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines?: { node?: string }
  packageManager?: string
  scripts: Record<string, string>
}
const gitignore = readFileSync('.gitignore', 'utf8')
const nvmrc = readFileSync('.nvmrc', 'utf8').trim()

test('repository pins the supported Node and npm toolchain and ignores test artifacts', () => {
  assert.equal(packageJson.engines?.node, '>=24.0.0 <25')
  assert.equal(packageJson.packageManager, 'npm@11.14.1')
  assert.equal(nvmrc, '24.15.0')
  assert.ok(gitignore.split(/\r?\n/).includes('/test-results/'))
})

test('standard CI enforces lint and browser smoke coverage', () => {
  assert.match(workflow, /run: npm run lint/)
  assert.match(workflow, /run: npm run test:smoke/)
})

test('manual staging release gate cannot silently skip authenticated E2E', () => {
  assert.match(workflow, /workflow_dispatch:/)
  const staging = workflow.split('  staging-release:')[1]
  assert.ok(staging)
  assert.match(staging, /CAMMS_E2E_REAL_AUTH: 'true'/)
  assert.match(staging, /^\s*npm run test:e2e:release\r?$/m)
  assert.equal(packageJson.scripts['test:e2e:release'], 'tsx scripts/release-e2e.ts')
})

test('manual staging release provisions PostgreSQL and seeds the E2E login on the runner', () => {
  const staging = workflow.split('  staging-release:')[1]
  assert.ok(staging)
  assert.doesNotMatch(staging, /SUPABASE|secrets\.DATABASE/)
  assert.match(staging, /npm run postgres:setup\s+npm run postgres:up\s+npm run postgres:app:setup\s+npm run postgres:activate/)
  assert.match(staging, /INITIAL_ADMIN_EMAIL="\$CAMMS_E2E_ADMIN_ID"/)
  assert.match(staging, /INITIAL_ADMIN_PASSWORD="\$CAMMS_E2E_ADMIN_PASSWORD"/)
  assert.match(staging, /if: always\(\)[\s\S]*compose\.postgres\.yaml down/)
})
