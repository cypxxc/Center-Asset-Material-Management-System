import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'

async function runJob(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), 'scripts/self-healing-job.ts'), ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATA_BACKEND: 'mock',
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (c) => { stdout += c })
  child.stderr.setEncoding('utf8').on('data', (c) => { stderr += c })

  const [code] = await once(child, 'exit') as [number | null]
  return { code, stdout, stderr }
}

test('CLI runner prints help when unknown arguments are passed or no args', async () => {
  const { code, stdout } = await runJob(['--help'])
  assert.equal(code, 0)
  assert.ok(stdout.includes('CAMMS Self-Healing & System Reliability CLI'))
  assert.ok(stdout.includes('--diagnose'))
  assert.ok(stdout.includes('--heal'))
})

test('CLI runner executes --diagnose and returns health summary', async () => {
  const { code, stdout } = await runJob(['--diagnose', '--mock'])
  assert.equal(code, 0)
  assert.ok(stdout.includes('Health Score:'))
  assert.ok(stdout.includes('Total Issues:'))
})

test('CLI runner executes --heal and reports remediation status', async () => {
  const { code, stdout } = await runJob(['--heal', '--mock'])
  assert.equal(code, 0)
  assert.ok(stdout.includes('Running Diagnostics & Self-Healing'))
  assert.ok(stdout.includes('Actions Completed:'))
})
