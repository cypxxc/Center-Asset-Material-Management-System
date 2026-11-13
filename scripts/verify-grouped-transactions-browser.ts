import { chromium, expect } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { parse } from 'dotenv'

async function main() {
  const credentials = parse(readFileSync('.env.postgres.admin'))
  const base = 'http://localhost:3000'
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(20000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.name))
  mkdirSync('.cache/grouped-transactions', { recursive: true })
  try {
    await page.goto(`${base}/login`)
    await page.locator('input[name=id]').fill(credentials.INITIAL_ADMIN_EMAIL)
    await page.locator('input[name=password]').fill(credentials.INITIAL_ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
    await page.waitForURL('**/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async () => {
      await page.screenshot({ path: '.cache/grouped-transactions/login-result.png' })
      const alert = await page.getByRole('alert').allTextContents()
      throw new Error(`Login did not reach dashboard; path=${new URL(page.url()).pathname}; alerts=${alert.join(' ')}`)
    })
    await page.goto(`${base}/disbursements?tab=requests&status=all`)
    await expect(page.getByRole('heading', { name: 'เบิก - จ่าย', exact: true })).toBeVisible()
    const expand = page.getByRole('button', { name: /^ขยายรายการ/ }).first()
    if (await expand.count()) {
      await expand.click()
      await expect(page.getByRole('table', { name: 'รายการพัสดุในคำขอ' }).first()).toBeVisible()
      await page.screenshot({ path: '.cache/grouped-transactions/desktop.png', fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: '.cache/grouped-transactions/mobile.png', fullPage: true })
      console.log('PASS: authenticated grouped document expansion at desktop and mobile widths')
    } else console.log('UNVERIFIED: no existing document fixture for browser expansion')
    await page.goto(`${base}/disbursements?tab=catalog`)
    const select = page.getByRole('checkbox', { name: 'เลือกทั้งหมดที่แสดง' })
    if (await select.count()) {
      await select.check()
      await expect(page.getByRole('button', { name: 'สร้างคำขอรวม', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'ล้างการเลือก', exact: true }).click()
      console.log('PASS: catalog checkbox bulk selection (no request submitted)')
    } else console.log('UNVERIFIED: no available assets for browser checkbox selection')
    if (errors.length) throw new Error(`Browser page errors: ${errors.join(', ')}`)
  } finally { await browser.close() }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : 'Browser verification failed'); process.exitCode = 1 })
