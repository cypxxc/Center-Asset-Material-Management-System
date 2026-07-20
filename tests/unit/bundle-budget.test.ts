import { test } from 'node:test'
import assert from 'node:assert'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

test('check-bundle-budget script executes successfully and outputs budget info', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'check-bundle-budget.ts')
  
  try {
    const stdout = execSync(`npx tsx "${scriptPath}"`, { encoding: 'utf8' })
    assert.ok(stdout.includes('[CAMMS-BUDGET]') || stdout.includes('[CAMMS-WARN]'))
    assert.match(stdout, /Shared runtime JS \(raw\): .* \/ 450\.00 KB/)
    assert.match(stdout, /Shared runtime JS \(gzip transfer\): .* \/ 150\.00 KB/)
    assert.match(stdout, /Dashboard route JS \(raw\): .* \/ 160\.00 KB/)
    assert.match(stdout, /Dashboard route JS \(gzip transfer\): .* \/ 50\.00 KB/)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    assert.fail(`Bundle budget check failed with error: ${message}`)
  }
})

test('header guide is deferred from the initial dashboard client boundary', () => {
  const headerSource = readFileSync('components/layout/header.tsx', 'utf8')
  assert.match(headerSource, /dynamic\(\s*\(\) => import\('\.\/header-guide-dialog'\)/)
  assert.doesNotMatch(headerSource, /CAMMS User Guide/)
})
