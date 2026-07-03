import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getMissingEnvVars, verifyEnv } from './verify-env'

test('uses safe fallback values for CI when Supabase secrets are missing', () => {
  const missing = getMissingEnvVars({ CI: 'true' } as unknown as NodeJS.ProcessEnv)

  assert.deepEqual(missing, [])
})

test('still reports missing env vars for local runs', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-env-'))
  const originalCwd = process.cwd()
  process.chdir(tempDir)

  try {
    const missing = getMissingEnvVars({ CI: 'false' } as unknown as NodeJS.ProcessEnv)

    assert.deepEqual(missing, [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ])
  } finally {
    process.chdir(originalCwd)
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('verifyEnv rejects invalid URL formats', () => {
  let exitCode: number | null = null
  const originalExit = process.exit
  // @ts-expect-error - mock exit
  process.exit = (code) => { exitCode = code }

  try {
    verifyEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'invalid-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'valid-long-anon-key-string-value-here',
      SUPABASE_SERVICE_ROLE_KEY: 'valid-long-service-key-string-value-here',
      CI: 'true',
    })
    assert.strictEqual(exitCode, 1)
  } finally {
    process.exit = originalExit
  }
})

test('verifyEnv rejects short tokens', () => {
  let exitCode: number | null = null
  const originalExit = process.exit
  // @ts-expect-error - mock exit
  process.exit = (code) => { exitCode = code }

  try {
    verifyEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short',
      SUPABASE_SERVICE_ROLE_KEY: 'valid-long-service-key-string-value-here',
      CI: 'true',
    })
    assert.strictEqual(exitCode, 1)
  } finally {
    process.exit = originalExit
  }
})

