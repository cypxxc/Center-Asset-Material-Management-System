import { test } from 'node:test'
import assert from 'node:assert'
import { execSync } from 'node:child_process'
import path from 'node:path'

test('check-bundle-budget script executes successfully and outputs budget info', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'check-bundle-budget.ts')
  
  try {
    const stdout = execSync(`npx tsx "${scriptPath}"`, { encoding: 'utf8' })
    assert.ok(stdout.includes('[CAMMS-BUDGET]') || stdout.includes('[CAMMS-WARN]'))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    assert.fail(`Bundle budget check failed with error: ${message}`)
  }
})
