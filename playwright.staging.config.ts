import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/staging',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'tests/e2e/staging/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    screenshot: 'on',
    video: 'off',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
