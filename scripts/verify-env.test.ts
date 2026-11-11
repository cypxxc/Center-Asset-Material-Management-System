import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getMissingEnvVars, verifyEnv } from './verify-env'

test('uses safe fallback values for CI when PostgreSQL secrets are missing', () => {
  const missing = getMissingEnvVars({ CI: 'true' } as unknown as NodeJS.ProcessEnv)

  assert.deepEqual(missing, [])
})

test('reports missing env vars for local runs', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-env-'))
  const originalCwd = process.cwd()
  process.chdir(tempDir)

  try {
    const missing = getMissingEnvVars({ CI: 'false' } as unknown as NodeJS.ProcessEnv)

    assert.deepEqual(missing, [
      'DATABASE_URL',
      'DATABASE_AUTH_URL',
      'LOCAL_STORAGE_PATH',
    ])
  } finally {
    process.chdir(originalCwd)
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('verifyEnv rejects invalid PostgreSQL URL formats', () => {
  let exitCode: number | null = null
  const originalExit = process.exit
  // @ts-expect-error - mock exit
  process.exit = (code) => { exitCode = code }

  try {
    verifyEnv({
      DATABASE_URL: 'invalid-url',
      DATABASE_AUTH_URL: 'postgres://camms:password@127.0.0.1:5432/camms',
      LOCAL_STORAGE_PATH: './files',
      CI: 'false',
    })
    assert.strictEqual(exitCode, 1)
  } finally {
    process.exit = originalExit
  }
})

test('verifyEnv rejects PostgreSQL URL without credentials or pathname', () => {
  let exitCode: number | null = null
  const originalExit = process.exit
  // @ts-expect-error - mock exit
  process.exit = (code) => { exitCode = code }

  try {
    verifyEnv({
      DATABASE_URL: 'postgres://localhost/',
      DATABASE_AUTH_URL: 'postgres://camms:password@127.0.0.1:5432/camms',
      LOCAL_STORAGE_PATH: './files',
      CI: 'false',
    })
    assert.strictEqual(exitCode, 1)
  } finally {
    process.exit = originalExit
  }
})

test('PostgreSQL validation passes when all settings are valid', () => {
  assert.deepEqual(getMissingEnvVars({ DATABASE_URL: 'postgres://app:password@localhost/db', DATABASE_AUTH_URL: 'postgres://auth:password@localhost/db', LOCAL_STORAGE_PATH: './files' }), [])
})
