import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'

async function setup() {
  const accounts = parse(readFileSync('.env.staging.accounts'))
  const browser = await chromium.launch()

  const roles = [
    { role: 'admin', email: accounts.UAT_ADMIN_EMAIL, pass: accounts.UAT_ADMIN_PASSWORD, path: 'tests/e2e/staging/.auth/admin.json' },
    { role: 'staff', email: accounts.UAT_STAFF_EMAIL, pass: accounts.UAT_STAFF_PASSWORD, path: 'tests/e2e/staging/.auth/staff.json' },
    { role: 'viewer', email: accounts.UAT_VIEWER_EMAIL, pass: accounts.UAT_VIEWER_PASSWORD, path: 'tests/e2e/staging/.auth/viewer.json' },
  ]

  for (const { role, email, pass, path } of roles) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3001' })
    const page = await context.newPage()

    await page.goto('/login')
    await page.fill('input[name="id"]', email)
    await page.fill('input[name="password"]', pass)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await context.storageState({ path })
    console.log(`Saved auth state for ${role} to ${path}`)
    await context.close()
  }

  await browser.close()
  console.log('All auth states generated.')
}

setup().catch((err) => {
  console.error('Auth setup failed:', err)
  process.exit(1)
})
