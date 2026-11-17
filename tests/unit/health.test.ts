import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'

let dbError: Error | null = null
let dbDelay = 0

const dbPath = require.resolve('../../lib/postgres/db')
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    getDatabase: () => ({
      execute: async () => {
        if (dbDelay > 0) await new Promise((r) => setTimeout(r, dbDelay))
        if (dbError) throw dbError
        return { rows: [{ '?column?': 1 }] }
      },
    }),
    getAuthDatabase: () => ({
      execute: async () => ({ rows: [] }),
    }),
  },
} as NodeJS.Module

import { GET as readiness } from '../../app/api/health/readiness/route'
import { GET as liveness } from '../../app/api/health/liveness/route'
import { GET as status } from '../../app/api/health/status/route'

test('/api/health/readiness returns structured checks', async () => {
  dbError = null
  dbDelay = 0

  const response = await readiness()
  const body = await response.json()
  assert.ok('checks' in body)
  assert.ok('database' in body.checks)
  assert.ok('storage' in body.checks)
  assert.ok('environment' in body.checks)
})

test('/api/health/readiness verifies PostgreSQL connectivity', async () => {
  dbError = null
  dbDelay = 0

  const response = await readiness()
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ready, true)
  assert.equal(body.checks.database.status, 'up')
})

test('/api/health/readiness checks database and storage concurrently', async () => {
  dbError = null
  dbDelay = 50

  const start = performance.now()
  const response = await readiness()
  const elapsedMs = performance.now() - start

  assert.equal(response.status, 200)
  assert.ok(elapsedMs < 140, `expected concurrent checks below 140ms, got ${elapsedMs}`)
  dbDelay = 0
})

test('/api/health/readiness logs sanitized dependency diagnostics without exposing them publicly', async () => {
  const secret = 'secret-password-12345'
  dbError = new Error(`connection failed with ${secret}`)
  const logLines: string[] = []
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => logLines.push(args.map(String).join(' '))

  try {
    const response = await readiness()
    const body = await response.json()

    assert.equal(response.status, 503)
    assert.equal(body.checks.database.status, 'down')
    assert.equal(body.checks.database.error, 'Dependency check failed')
    assert.equal(JSON.stringify(body).includes(secret), false)
  } finally {
    console.error = originalConsoleError
    dbError = null
  }
})

test('/api/health/liveness returns alive', async () => {
  const response = await liveness()
  const body = await response.json()
  assert.equal(body.alive, true)
  assert.ok(typeof body.uptime === 'number')
})

test('/api/health/status returns runtime metadata', async () => {
  const response = await status()
  const body = await response.json()
  assert.ok(body.version)
  assert.ok(body.node?.version)
  assert.ok(body.memory?.heapUsed)
})
