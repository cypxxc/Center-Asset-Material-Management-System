import test from 'node:test'
import assert from 'node:assert/strict'

try {
  const filename = require.resolve('server-only')
  require.cache[filename] = { id: filename, filename, loaded: true, exports: {} } as NodeJS.Module
} catch {
  // Ignored
}

test('pruneLoginAttempts is exported as a standalone function', async () => {
  const mod = await import('./login-throttle.js')
  assert.equal(typeof mod.pruneLoginAttempts, 'function')
})

test('consumeLoginAttempt signature remains unchanged', async () => {
  const mod = await import('./login-throttle.js')
  assert.equal(typeof mod.consumeLoginAttempt, 'function')
})
