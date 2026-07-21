import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  engines?: { node?: string }
  packageManager?: string
  scripts: Record<string, string>
}
const gitignore = readFileSync('.gitignore', 'utf8')
const nvmrc = readFileSync('.nvmrc', 'utf8').trim()

test('repository pins the supported Node and npm toolchain and ignores test artifacts', () => {
  assert.equal(packageJson.engines?.node, '>=20.19.0 <21')
  assert.equal(packageJson.packageManager, 'npm@11.14.1')
  assert.equal(nvmrc, '20.19.5')
  assert.ok(gitignore.split(/\r?\n/).includes('/test-results/'))
})
