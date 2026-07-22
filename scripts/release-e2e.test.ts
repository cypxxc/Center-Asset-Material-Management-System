import assert from 'node:assert/strict'
import test from 'node:test'

import { getE2EInvocation, validateReleaseE2EEnv } from './release-e2e'
import { getPlaywrightInvocation, settleWithin } from './run-playwright'
import playwrightConfig, { getWebServerConfig } from '../playwright.config'

test('release E2E rejects missing real-auth prerequisites', () => {
  assert.deepEqual(validateReleaseE2EEnv({}), [
    'CAMMS_E2E_REAL_AUTH must be set to true',
    'CAMMS_E2E_ADMIN_ID is required',
    'CAMMS_E2E_ADMIN_PASSWORD is required',
  ])
})

test('release E2E accepts complete real-auth prerequisites', () => {
  assert.deepEqual(validateReleaseE2EEnv({
    CAMMS_E2E_REAL_AUTH: 'true',
    CAMMS_E2E_ADMIN_ID: 'admin@registry.s',
    CAMMS_E2E_ADMIN_PASSWORD: 'secret',
  }), [])
})

test('release E2E invokes npm through Node without a Windows command wrapper', () => {
  assert.deepEqual(getE2EInvocation({ npm_execpath: 'C:/node/npm-cli.js' }), {
    command: process.execPath,
    args: ['C:/node/npm-cli.js', 'run', 'test:e2e'],
  })
})

test('Playwright starts Next directly so Windows teardown reaches the server process', () => {
  const webServer = playwrightConfig.webServer
  assert.ok(webServer && !Array.isArray(webServer))
  assert.equal(webServer.command, 'node node_modules/next/dist/bin/next start')
  assert.equal(webServer.reuseExistingServer, false)
})

test('external server orchestration disables Playwright webServer ownership', () => {
  assert.equal(getWebServerConfig({ PLAYWRIGHT_EXTERNAL_SERVER: 'true' }), undefined)
  assert.ok(getWebServerConfig({}))
})

test('Playwright runner invokes its Node CLI without an npm wrapper', () => {
  assert.deepEqual(getPlaywrightInvocation('chromium'), {
    command: process.execPath,
    args: ['node_modules/@playwright/test/cli.js', 'test', '--project=chromium'],
  })
})

test('server cleanup is bounded when an OS process never reports exit', async () => {
  assert.equal(await settleWithin(Promise.resolve(), 20), true)
  assert.equal(await settleWithin(new Promise<void>(() => {}), 20), false)
})
