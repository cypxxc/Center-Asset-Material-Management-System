import { chromium, expect } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

async function main() {
  const target = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000')
  if (!['http:', 'https:'].includes(target.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('PLAYWRIGHT_BASE_URL must be an HTTP(S) loopback origin without credentials, a path, query or fragment')
  }
  const baseURL = target.origin
  const editRuns = Number(process.env.BROWSER_EDIT_RUNS ?? 3)
  if (!Number.isInteger(editRuns) || editRuns < 1 || editRuns > 20) throw new Error('BROWSER_EDIT_RUNS must be between 1 and 20')
  const diagnostics: unknown[] = []
  const app = parse(readFileSync('.env.local'))
  if (app.DATA_BACKEND !== 'postgres' || Object.keys(app).some(key=>key.includes('SUPABASE'))) throw new Error('This check requires PostgreSQL mode without Supabase configuration')
  const admin = parse(readFileSync('.env.postgres.admin'))
  const owner = new Pool({connectionString:parse(readFileSync('.env.postgres.app')).DATABASE_MIGRATION_URL})
  const fixture = `Browser-${randomUUID()}`
  // Node verifies the certificate chain (optionally using NODE_EXTRA_CA_CERTS).
  // Chromium has a separate trust store; bypass it only after this loopback TLS check.
  if (new URL(baseURL).protocol === 'https:') {
    const health = await fetch(baseURL+'/api/health/readiness',{signal:AbortSignal.timeout(15000)})
    expect(health.status).toBe(200)
  }
  const browser = await chromium.launch({headless:true})
  const page = await browser.newPage({ignoreHTTPSErrors:new URL(baseURL).protocol === 'https:'})
  page.setDefaultTimeout(30000)
  const external: string[]=[]
  page.on('request',request => { if (/supabase\.(co|com)/i.test(request.url())) external.push(request.url()) })
  try {
    await page.goto(`${baseURL}/login`,{timeout:90000})
    await page.locator('input[name=id]').fill(admin.INITIAL_ADMIN_EMAIL)
    await page.locator('input[name=password]').fill(admin.INITIAL_ADMIN_PASSWORD)
    await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
    await page.waitForURL('**/dashboard',{timeout:90000})
    for (const path of ['/dashboard','/items','/locations','/reports','/settings','/admin/users','/admin/audit-logs','/admin/db-panel','/profile']) {
      const response = await page.request.get(`${baseURL}${path}`,{timeout:90000})
      expect(response.status(),path).toBe(200)
      await page.goto(`${baseURL}${path}`,{timeout:90000,waitUntil:'domcontentloaded'})
      await page.waitForURL(`**${path}`,{timeout:30000})
      await expect(page.locator('body')).not.toContainText('Application error')
      await expect(page.locator('body')).not.toContainText('เกิดข้อผิดพลาดที่ไม่คาดคิด')
      console.log(`PASS: authenticated ${path}`)
    }
    await page.goto(`${baseURL}/settings?tab=units`)
    await page.getByLabel('ชื่อหน่วยนับใหม่',{exact:true}).fill(fixture)
    await page.getByRole('button',{name:'เพิ่มหน่วยนับ',exact:true}).click()
    await expect(page.locator(`input[name=name][value="${fixture}"]:visible`)).toHaveValue(fixture)
    await page.goto(`${baseURL}/items/new`)
    await page.locator('input[name=item_name]:visible').fill(fixture)
    await page.locator('#quantity:visible').fill('2')
    await page.locator('#unit_price:visible').fill('125.50')
    await page.locator('select[name=unit_id]:visible').selectOption({label:fixture})
    await page.locator('button[type=submit]:visible').filter({hasText:/บันทึก/}).click()
    await page.waitForURL(url => url.pathname === '/items')
    await expect.poll(async ()=>(await owner.query('select count(*)::int as count from public.items where item_name=$1',[fixture])).rows[0].count).toBe(1)
    const item = (await owner.query('select id,quantity,unit_price from public.items where item_name=$1',[fixture])).rows[0]
    expect(item.quantity).toBe(2)
    expect(Number(item.unit_price)).toBe(125.5)
    const editPath = `/items/${item.id}/edit`
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === editPath) {
        // Capture only the fixture quantity, never cookies, credentials or the full action payload.
        diagnostics.push({ event: 'edit-request', quantity: (request.postData() ?? '').match(/name="[^" ]*quantity"[^]*?\r\n\r\n([^\r]*)/)?.[1] })
      }
    })
    page.on('response', response => {
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === editPath) {
        diagnostics.push({ event: 'edit-response', status: response.status(), redirect: response.headers()['x-action-redirect'] })
      }
    })
    for (let run = 0; run < editRuns; run++) {
      const quantity = String(3 + run)
      if (run === 0) {
        // Deterministically reproduce the original race: HTML is visible before JS is ready.
        let releaseScripts!: () => void
        const blocked = new Promise<void>(resolve => { releaseScripts = resolve })
        const holdScript = async (route: import('@playwright/test').Route) => { await blocked; await route.continue() }
        await page.route('**/_next/static/**/*.js', holdScript)
        try {
          await page.goto(`${baseURL}${editPath}`, { waitUntil: 'domcontentloaded' })
          diagnostics.push({ event: 'before-hydration', editable: await page.locator('#quantity:visible').isEnabled() })
          await expect(page.locator('#quantity:visible')).toBeDisabled()
        } finally {
          releaseScripts()
          await page.unrouteAll({ behavior: 'wait' })
        }
      } else {
        await page.goto(`${baseURL}${editPath}`)
      }
      const visibleQuantity = page.locator('#quantity:visible')
      await visibleQuantity.fill(quantity)
      const submittedQuantity = visibleQuantity.locator('..').locator('input[name=quantity]')
      await expect(submittedQuantity).toHaveValue(quantity)
      diagnostics.push({ event: 'before-submit', run: run + 1, visible: await visibleQuantity.inputValue(), submitted: await submittedQuantity.inputValue() })
      const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === editPath)
      await page.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click()
      const response = await responsePromise
      expect(response.status()).toBe(200)
      await page.waitForURL(url => url.pathname === `/items/${item.id}`)
      const stored = (await owner.query('select quantity from public.items where id=$1',[item.id])).rows[0].quantity
      diagnostics.push({ event: 'stored', run: run + 1, quantity: stored })
      expect(stored).toBe(Number(quantity))
      console.log(`PASS: edit ${run + 1}/${editRuns} submitted and stored quantity ${quantity}.`)
    }
    await page.goto(`${baseURL}/items/${item.id}`)
    await expect(page.locator('main')).toContainText(fixture)
    console.log('PASS: browser creates metadata and item, edits item; stored PostgreSQL values verified.')
    const readiness = await page.request.get(`${baseURL}/api/health/readiness`)
    expect(readiness.status()).toBe(200)
    const anonymous = await browser.newContext({ignoreHTTPSErrors:new URL(baseURL).protocol === 'https:'})
    expect((await anonymous.request.get(`${baseURL}/api/events?tables=items`)).status()).toBe(401)
    const protectedPage = await anonymous.request.get(`${baseURL}/items`,{maxRedirects:0})
    expect(protectedPage.status()).toBe(307)
    await anonymous.close()
    console.log('PASS: readiness, anonymous route guards, no Supabase requests.')
    expect(external).toEqual([])
    mkdirSync('.cache/postgres',{recursive:true})
    await page.screenshot({path:'.cache/postgres/browser-item.png',fullPage:true})
    await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click()
    await page.waitForURL('**/login')
    console.log('PASS: sign out redirects to login.')
  } finally {
    mkdirSync('.cache/postgres',{recursive:true})
    writeFileSync('.cache/postgres/browser-edit-diagnostics.json', JSON.stringify(diagnostics, null, 2))
    await browser.close()
    try {
      await owner.query('delete from public.items where item_name=$1',[fixture])
      await owner.query('delete from public.units where name=$1',[fixture])
      await owner.query("delete from public.audit_logs where old_data->>'item_name'=$1 or new_data->>'item_name'=$1 or old_data->>'name'=$1 or new_data->>'name'=$1",[fixture])
    } finally { await owner.end() }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
