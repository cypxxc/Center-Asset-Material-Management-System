import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import type { Pool } from 'pg'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

type Result = { id: string; title: string; status: 'PASS' | 'FAIL'; details: string; screenshot?: string }
type Options = { baseUrl: string; browser: Browser; contexts: { user: BrowserContext; other: BrowserContext; admin: BrowserContext }; fixture: { items: Record<string, { id: string; name: string }>; users: { user: string; other: string; admin: string } }; owner: Pool; outputDir: string }

/** UI mutations exclusively; SQL is read-only evidence against the isolated UAT database. */
export async function runDisbursementBrowserUAT({ baseUrl, browser, contexts, fixture, owner, outputDir }: Options): Promise<Result[]> {
  await mkdir(outputDir, { recursive: true })
  const pages = { user: await contexts.user.newPage(), other: await contexts.other.newPage(), admin: await contexts.admin.newPage() }
  const results: Result[] = []
  const errors: string[] = []
  let activeCase = 'setup'
  Object.entries(pages).forEach(([role, page]) => page.on('pageerror', error => errors.push(`${activeCase} ${role} ${page.url()}: ${error.message}`)))
  const ids: Record<string, string> = {}
  async function run(id: string, title: string, page: Page, test: () => Promise<string | void>) {
    if (process.env.UAT_CASES && !process.env.UAT_CASES.split(',').includes(id)) return
    activeCase = id
    console.log(`[UAT ${id}] ${title}`)
    try {
      const details = await test()
      const screenshot = path.join(outputDir, `${id}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      results.push({ id, title, status: 'PASS', details: details || 'Browser assertions passed.', screenshot })
      console.log(`[UAT ${id}] PASS`)
    }
    catch (error) {
      const screenshot = path.join(outputDir, `${id}.png`)
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined)
      results.push({ id, title, status: 'FAIL', details: String(error), screenshot })
      console.log(`[UAT ${id}] FAIL ${String(error).slice(0, 160)}`)
    }
  }
  async function catalog(page: Page, key: string) {
    const isMat = ['issueMaterial', 'reverse', 'adminDraft'].includes(key)
    await page.goto(`${baseUrl}/disbursements?tab=catalog`)
    await page.waitForLoadState('domcontentloaded')
    if (isMat) {
      await page.getByRole('button', { name: /วัสดุ/ }).click()
    } else {
      const assetBtn = page.getByRole('button', { name: /ครุภัณฑ์/ })
      if (await assetBtn.isVisible()) {
        const isPressed = await assetBtn.getAttribute('aria-pressed')
        if (isPressed !== 'true') await assetBtn.click()
      }
    }
    const search = page.locator('input[type="search"], input[placeholder*="ค้นหา"]').first()
    await search.fill(fixture.items[key].name)
    await page.waitForTimeout(500)
  }
  const heading = (page: Page, key: string) => page.getByRole('heading', { name: fixture.items[key].name })
  async function doc(key: string) {
    const result = await owner.query('SELECT d.* FROM public.disbursements d JOIN public.disbursement_items di ON di.disbursement_id=d.id WHERE di.item_id=$1 ORDER BY d.created_at DESC LIMIT 1', [fixture.items[key].id])
    return result.rows[0]
  }
  async function state(key: string, status: string) { await expect.poll(async () => (await doc(key))?.status, { timeout: 20000 }).toBe(status) }
  async function quantity(key: string, amount: number) { await expect.poll(async () => Number((await owner.query('SELECT quantity FROM public.inventory_items WHERE id=$1', [fixture.items[key].id])).rows[0]?.quantity)).toBe(amount) }
  async function request(key: string, type: 'borrow' | 'issue' = 'borrow') {
    const page = pages.user
    await catalog(page, key)
    const card = page.locator('[data-cart-card]', { hasText: fixture.items[key].name }).first()
    await card.locator('button[data-cart-btn]').click()
    await page.getByRole('button', { name: /ตะกร้า/ }).click()
    const dialog = page.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' })
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.locator('#central-request-purpose').fill(`AI-UAT ${key}`)
    if (type === 'issue' && key === 'issueAsset') {
      await dialog.getByRole('button', { name: `การทำรายการ ${fixture.items[key].name}`, exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'เบิก', exact: true }).click()
    }
    const dueInput = dialog.locator('#central-request-due-date')
    if (await dueInput.isVisible()) {
      await dueInput.fill('2026-12-31')
    }
    await dialog.getByRole('button', { name: 'ยืนยันคำขอ', exact: true }).click()
    await expect(dialog).toBeHidden({ timeout: 20000 })
    await state(key, 'pending_approval')
    ids[key] = (await doc(key)).id
  }
  async function detail(page: Page, key: string) {
    if (!ids[key]) throw new Error(`Prerequisite request ${key} did not complete`)
    await page.goto(`${baseUrl}/disbursements/${ids[key]}`)
    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
    await expect(page.getByText(`AI-UAT ${key}`, { exact: true }).first()).toBeVisible()
  }
  async function approve(key: string, status = 'active_borrow') {
    await pages.admin.goto(`${baseUrl}/disbursements?tab=requests&status=all`)
    await pages.admin.getByRole('row').filter({ has: pages.admin.locator(`[id="expand-${ids[key]}"]`) }).getByRole('button', { name: 'ยืนยัน', exact: true }).click()
    await state(key, status)
    await expect(pages.admin.getByRole('dialog')).toHaveCount(0)
  }
  async function returnItem(key: string, condition: 'normal' | 'damaged' | 'lost') {
    await detail(pages.admin, key)
    await pages.admin.getByRole('button', { name: 'รับคืนทั้งหมด (1)', exact: true }).click()
    const dialog = pages.admin.getByRole('dialog')
    const labels = { normal: 'ปกติ', damaged: 'ชำรุด', lost: 'สูญหาย' }
    await dialog.getByRole('button', { name: labels[condition], exact: true }).click()
    await dialog.getByLabel('เหตุผลในการคืน').fill(`AI-UAT ${condition}`)
    await dialog.getByRole('button', { name: 'ยืนยันรับคืน (1 รายการ)', exact: true }).click()
    await state(key, 'returned')
    await expect(dialog).toBeHidden()
    const event = await owner.query(
      "SELECT item_condition FROM public.asset_custody_logs WHERE item_id=$1 AND action='return'",
      [fixture.items[key].id],
    )
    expect(event.rows).toEqual([{ item_condition: condition }])
  }
  try {
    await run('B00', 'Admin navigates disbursements from the sidebar without duplicate tabs', pages.admin, async () => {
      const page = pages.admin
      await page.goto(`${baseUrl}/disbursements`)
      const requests = page.getByRole('link', { name: 'เบิก', exact: true })
      const documents = page.getByRole('link', { name: 'จ่าย', exact: true })
      for (const [link, tab] of [[requests, 'requests'], [documents, 'documents']] as const) {
        await link.click()
        await expect(page).toHaveURL(url => url.searchParams.get('tab') === tab)
        await expect(link).toHaveAttribute('aria-current', 'page')
        await expect(page.getByRole('button', { name: 'จ่าย', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'อนุมัติ', exact: true })).toHaveCount(0)
      }
    })

    await run('B01', 'Catalog search matches exact item and excludes unrelated items', pages.user, async () => {
      await catalog(pages.user, 'borrow'); await expect(heading(pages.user, 'borrow')).toBeVisible(); await expect(heading(pages.user, 'cancel')).toHaveCount(0)
    })
    await run('B02', 'Empty purpose is rejected without creating a request', pages.user, async () => {
      await catalog(pages.user, 'validation')
      const card = pages.user.locator('[data-cart-card]', { hasText: fixture.items.validation.name }).first()
      await card.locator('button[data-cart-btn]').click()
      await pages.user.getByRole('button', { name: /ตะกร้า/ }).click()
      const dialog = pages.user.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' })
      await dialog.locator('#central-request-purpose').fill('')
      await dialog.getByRole('button', { name: 'ยืนยันคำขอ', exact: true }).click()
      const isValid = await dialog.locator('#central-request-purpose').evaluate((el: HTMLTextAreaElement) => el.checkValidity())
      expect(isValid).toBe(false)
      expect(await doc('validation')).toBeUndefined()
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
    })
    await run('B03', 'User submits borrow request', pages.user, async () => { await request('borrow'); return `Created pending request ${ids.borrow}` })
    await run('B04', 'Reserved asset disappears from other user ready catalog', pages.other, async () => { await catalog(pages.other, 'borrow'); await expect(heading(pages.other, 'borrow')).toHaveCount(0) })
    await run('B05', 'Admin request row displays requester, item and quantity', pages.admin, async () => {
      await pages.admin.goto(`${baseUrl}/disbursements?tab=requests&status=pending_approval`)
      const row = pages.admin.getByRole('row').filter({ has: pages.admin.locator(`[id="expand-${ids.borrow}"]`) })
      await expect(row).toContainText('UAT User')
      await expect(row).toContainText('1 รายการ')
      await row.getByRole('button', { name: /^ขยายรายการ/ }).click()
      const items = pages.admin.locator(`[id="transaction-${ids.borrow}"]`)
      await expect(items).toContainText(fixture.items.borrow.name)
    })
    await run('B06', 'User cannot approve own request', pages.user, async () => { await detail(pages.user, 'borrow'); await expect(pages.user.getByRole('button', { name: 'อนุมัติและจ่าย', exact: true })).toHaveCount(0) })
    await run('B20', 'Pending request details identify the requested item before approval', pages.user, async () => {
      await detail(pages.user, 'borrow')
      await expect(pages.user.getByText(fixture.items.borrow.name,{exact:true}).first()).toBeVisible()
    })
    await run('B07', 'Admin row approves with one click and no confirmation dialog', pages.admin, async () => {
      await pages.admin.goto(`${baseUrl}/disbursements?tab=requests&status=pending_approval`)
      await pages.admin.getByRole('row').filter({ has: pages.admin.locator(`[id="expand-${ids.borrow}"]`) }).getByRole('button', { name: 'ยืนยัน', exact: true }).click()
      await state('borrow', 'active_borrow'); await expect(pages.admin.getByRole('dialog')).toHaveCount(0)
    })
    await run('B08', 'Active borrow normal return restores catalog eligibility', pages.admin, async () => { await returnItem('borrow', 'normal'); await catalog(pages.other, 'borrow'); await expect(heading(pages.other, 'borrow')).toBeVisible() })
    await run('B09', 'Material issue reduces stock from ten to nine without exposing the asset-loan return action', pages.admin, async () => {
      await request('issueMaterial', 'issue'); await quantity('issueMaterial', 9); await approve('issueMaterial', 'confirmed'); await quantity('issueMaterial', 9); await detail(pages.admin, 'issueMaterial'); await expect(pages.admin.getByRole('button', { name: /^รับคืนทั้งหมด/ })).toHaveCount(0)
    })
    await run('B10', 'Asset issue removes asset from central ready pool', pages.admin, async () => {
      await request('issueAsset', 'issue'); await approve('issueAsset', 'confirmed'); await catalog(pages.other, 'issueAsset'); await expect(heading(pages.other, 'issueAsset')).toHaveCount(0)
    })
    await run('B11', 'Other user cannot withdraw another requester document', pages.other, async () => { await request('cancel'); await pages.other.goto(`${baseUrl}/disbursements/${ids.cancel}`); await expect(pages.other.getByRole('button', { name: 'ถอนคำขอ', exact: true })).toHaveCount(0); await state('cancel', 'pending_approval') })
    await run('B12', 'Requester withdraws pending request and releases reserved item', pages.user, async () => {
      await detail(pages.user, 'cancel'); await pages.user.getByRole('button', { name: 'ถอนคำขอ', exact: true }).click(); await pages.user.getByRole('button', { name: 'ยืนยันถอนคำขอ', exact: true }).click(); await state('cancel', 'cancelled'); await catalog(pages.other, 'cancel'); await expect(heading(pages.other, 'cancel')).toBeVisible()
    })
    await run('B13', 'Admin rejects with persisted reason and releases stock; rejected details redirect to history', pages.admin, async () => {
      await request('reject')
      await pages.admin.goto(`${baseUrl}/disbursements?tab=requests&status=all`)
      await pages.admin.getByRole('row').filter({ has: pages.admin.locator(`[id="expand-${ids.reject}"]`) }).getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await pages.admin.getByRole('dialog').getByRole('textbox').fill('AI-UAT unavailable for scheduled work')
      await pages.admin.getByRole('button', { name: 'ยกเลิกคำขอ', exact: true }).click()
      await state('reject', 'rejected')
      await pages.user.goto(`${baseUrl}/disbursements/${ids.reject}`)
      await expect(pages.user).toHaveURL(/\/disbursements\?tab=documents/)
      const rejected = await doc('reject')
      expect(JSON.stringify(rejected)).toContain('AI-UAT unavailable for scheduled work')
      await catalog(pages.other, 'reject'); await expect(heading(pages.other, 'reject')).toBeVisible()
    })
    for (const condition of ['damaged', 'lost'] as const) await run(condition === 'damaged' ? 'B14' : 'B15', `Borrow returned ${condition} stays outside ready pool`, pages.admin, async () => {
      await request(condition); await approve(condition); await returnItem(condition, condition); await catalog(pages.other, condition); await expect(heading(pages.other, condition)).toHaveCount(0)
    })
    await run('B16', 'Material issue reversal restores quantity and records reason', pages.admin, async () => {
      await request('reverse', 'issue'); await approve('reverse', 'confirmed'); await quantity('reverse', 9); await detail(pages.admin, 'reverse'); await pages.admin.getByRole('button', { name: 'คืนสภาพเอกสาร (Reverse)', exact: true }).click(); await pages.admin.locator('#reverse-reason-textarea').fill('AI-UAT erroneous issue'); await pages.admin.getByRole('button', { name: 'ยืนยันคืนสภาพ', exact: true }).click(); await state('reverse', 'reversed'); await quantity('reverse', 10); await pages.admin.reload(); await expect(pages.admin.getByText(/AI-UAT erroneous issue/).first()).toBeVisible()
    })
    await run('B17', 'Requester history search finds own completed request', pages.user, async () => {
      await pages.user.goto(`${baseUrl}/disbursements?tab=documents&q=AI-UAT%20borrow`)
      await expect(pages.user.locator(`[id="expand-${ids.borrow}"]`)).toBeVisible()
    })
    await run('B18', 'Mobile catalog and request form fit viewport', pages.user, async () => {
      await pages.user.setViewportSize({ width: 390, height: 844 })
      await catalog(pages.user, 'validation')
      const card = pages.user.locator('[data-cart-card]', { hasText: fixture.items.validation.name }).first()
      await card.locator('button[data-cart-btn]').click()
      await pages.user.getByRole('button', { name: /ตะกร้า/ }).click()
      const dialog = pages.user.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' })
      await expect(dialog).toBeVisible()
      expect(await pages.user.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await pages.user.screenshot({ path: path.join(outputDir, 'mobile-request.png'), fullPage: true })
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
    })
    await run('B21', 'Concurrent users requesting the same asset create exactly one pending request', pages.user, async () => {
      await pages.user.setViewportSize({ width: 1280, height: 900 })
      async function prepare(page: Page) {
        await catalog(page, 'concurrent')
        const card = page.locator('[data-cart-card]', { hasText: fixture.items.concurrent.name }).first()
        await card.locator('button[data-cart-btn]').click()
        await page.getByRole('button', { name: /ตะกร้า/ }).click()
        const dialog = page.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' })
        await dialog.locator('#central-request-purpose').fill('AI-UAT concurrent')
        const due = dialog.locator('#central-request-due-date')
        if (await due.isVisible()) await due.fill('2026-12-31')
      }
      await Promise.all([prepare(pages.user), prepare(pages.other)])
      await Promise.all([pages.user, pages.other].map(page => page.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' }).getByRole('button', { name: 'ยืนยันคำขอ', exact: true }).click()))
      await state('concurrent', 'pending_approval')
      await expect.poll(async () => {
        const messages = await Promise.all([pages.user, pages.other].map(page => page.getByText('รายการนี้มีคำขอรออนุมัติหรือกำลังยืม ไม่สามารถทำรายการซ้ำได้', { exact: true }).count()))
        return messages.filter(count => count > 0).length
      }, { timeout: 20000 }).toBe(1)
      const documents = await owner.query('SELECT d.id,d.created_by,d.status FROM public.disbursements d JOIN public.disbursement_items di ON di.disbursement_id=d.id WHERE di.item_id=$1', [fixture.items.concurrent.id])
      expect(documents.rows).toHaveLength(1)
      expect([fixture.users.user, fixture.users.other]).toContain(documents.rows[0].created_by)
      ids.concurrent = documents.rows[0].id
      const losingPage = documents.rows[0].created_by === fixture.users.user ? pages.other : pages.user
      await losingPage.reload()
      await expect(losingPage.getByRole('button', { name: 'ตรวจสอบคำขอที่ส่งล่าสุด' })).toBeVisible()
      return `Single request ${ids.concurrent}; winner ${documents.rows[0].created_by}; losing user received reservation error.`
    })
    await run('B22', 'Concurrent stale admin approvals create one custody borrow event', pages.admin, async () => {
      const secondAdmin = await contexts.admin.newPage()
      secondAdmin.on('pageerror', error => errors.push(`admin concurrent: ${error.message}`))
      try {
        await Promise.all([pages.admin, secondAdmin].map(page => page.goto(`${baseUrl}/disbursements?tab=requests&status=all`)))
        await Promise.all([pages.admin, secondAdmin].map(page => page.getByRole('row').filter({ has: page.locator(`[id="expand-${ids.concurrent}"]`) }).getByRole('button', { name: 'ยืนยัน', exact: true }).click()))
        await state('concurrent', 'active_borrow')
        await expect.poll(async () => Number((await owner.query("SELECT count(*) AS count FROM public.asset_custody_logs WHERE item_id=$1 AND action='borrow'", [fixture.items.concurrent.id])).rows[0].count)).toBe(1)
        const lines = await owner.query('SELECT issued_qty FROM public.disbursement_items WHERE disbursement_id=$1', [ids.concurrent])
        expect(lines.rows).toHaveLength(1)
        expect(Number(lines.rows[0].issued_qty)).toBe(1)
        await quantity('concurrent', 1)
      } finally { await secondAdmin.close() }
    })
    await run('B23', 'Approved borrow print voucher opens with item name and document number', pages.admin, async () => {
      await detail(pages.admin, 'concurrent')
      const popupPromise = pages.admin.waitForEvent('popup')
      await pages.admin.getByRole('button', { name: 'พิมพ์ใบเบิก-จ่าย (A4)', exact: true }).click()
      const popup = await popupPromise
      try {
        await popup.waitForLoadState('domcontentloaded')
        await expect(popup.locator('body')).toContainText(fixture.items.concurrent.name)
        await expect(popup.locator('body')).toContainText((await doc('concurrent')).document_no)
        await popup.screenshot({ path: path.join(outputDir, 'B23-voucher.png'), fullPage: true })
      } finally { await popup.close() }
    })
    await run('B24', 'Borrow without due date is blocked and creates no document', pages.user, async () => {
      await catalog(pages.user, 'validation')
      const card = pages.user.locator('[data-cart-card]', { hasText: fixture.items.validation.name }).first()
      await card.locator('button[data-cart-btn]').click()
      await pages.user.getByRole('button', { name: /ตะกร้า/ }).click()
      const dialog = pages.user.getByRole('dialog', { name: 'สร้างคำขอเบิก–ยืม' })
      await dialog.locator('#central-request-purpose').fill('AI-UAT invalid missing date')
      const dueInput = dialog.locator('#central-request-due-date')
      await dueInput.fill('')
      await dialog.getByRole('button', { name: 'ยืนยันคำขอ', exact: true }).click()
      const isValid = await dueInput.evaluate((el: HTMLInputElement) => el.checkValidity())
      expect(isValid).toBe(false)
      expect(await doc('validation')).toBeUndefined()
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
    })
    await run('B25', 'Material ledgers and document audit actors match completed UI actions', pages.admin, async () => {
      const issue = await owner.query('SELECT delta,balance_after,movement_type,created_by FROM public.stock_movements WHERE item_id=$1', [fixture.items.issueMaterial.id])
      expect(issue.rows).toHaveLength(1)
      expect(Number(issue.rows[0].delta)).toBe(-1)
      expect(Number(issue.rows[0].balance_after)).toBe(9)
      expect(issue.rows[0].movement_type).toBe('issue')
      expect(issue.rows[0].created_by).toBe(fixture.users.user)
      const reversal = await owner.query('SELECT delta,balance_after,movement_type,created_by FROM public.stock_movements WHERE item_id=$1', [fixture.items.reverse.id])
      expect(reversal.rows).toHaveLength(2)
      expect(reversal.rows.map(row => row.movement_type).sort()).toEqual(['issue', 'reversal'])
      expect(reversal.rows.reduce((sum, row) => sum + Number(row.delta), 0)).toBe(0)
      expect(reversal.rows.find(row => row.movement_type === 'reversal').created_by).toBe(fixture.users.admin)
      const audits = await owner.query('SELECT action,user_id FROM public.audit_logs WHERE target_table=$1 AND target_id=$2', ['disbursements', ids.reverse])
      for (const [action, actor] of [['REQUEST_ISSUE', fixture.users.user], ['CONFIRM_DISBURSEMENT', fixture.users.admin], ['REVERSE_DISBURSEMENT', fixture.users.admin]]) {
        expect(audits.rows.filter(row => row.action === action && row.user_id === actor)).toHaveLength(1)
      }
      return 'Issue ledger -1/balance9; reversal net0; request, confirmation and reversal audit actors verified.'
    })
    await run('B26', 'Anonymous disbursement access redirects to login', pages.user, async () => {
      const anonymous = await browser.newContext()
      try {
        const page = await anonymous.newPage()
        await page.goto(`${baseUrl}/disbursements`)
        await expect(page).toHaveURL(/\/login(?:\?|$)/)
        await page.screenshot({ path: path.join(outputDir, 'B26-anonymous-login.png'), fullPage: true })
      } finally { await anonymous.close() }
    })
    await run('B27', 'Admin assigns custody through UI and pool/history/audit reflect recipient', pages.admin, async () => {
      await pages.admin.goto(`${baseUrl}/disbursements?tab=documents`)
      await pages.admin.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
      await pages.admin.getByRole('button', { name: 'สั่งจ่าย', exact: true }).first().click()
      const form = pages.admin.getByRole('dialog', { name: 'สั่งจ่ายสิ่งของส่วนกลาง' })
      await expect(form).toBeVisible()
      await form.getByRole('button', { name: 'เลือกสิ่งของ', exact: true }).click()
      const picker = pages.admin.getByRole('dialog', { name: 'เลือกสิ่งของส่วนกลาง' })
      await picker.getByRole('textbox', { name: 'ค้นหาสิ่งของส่วนกลาง' }).fill(fixture.items.assignment.name)
      await picker.getByRole('checkbox', { name: `เลือก ${fixture.items.assignment.name}`, exact: true }).check({ force: true })
      await picker.getByRole('button', { name: 'ยืนยันรายการ (1)', exact: true }).click()
      await form.locator('#custody-recipient').click()
      await pages.admin.getByRole('option', { name: 'UAT User', exact: true }).click()
      await form.getByRole('button', { name: 'ยืนยันสั่งจ่าย', exact: true }).click()
      await expect(form).toBeHidden({ timeout: 20000 })
      await expect.poll(async () => (await owner.query('SELECT responsible_person FROM public.items WHERE id=$1', [fixture.items.assignment.id])).rows[0].responsible_person).toBe('UAT User')
      const row = pages.admin.getByRole('row').filter({ hasText: fixture.items.assignment.name })
      await expect(row).toContainText('UAT User')
      const audit = await owner.query("SELECT user_id,new_data FROM public.audit_logs WHERE target_id=$1 AND target_table='items' AND action='ASSIGN_CUSTODY'", [fixture.items.assignment.id])
      expect(audit.rows).toHaveLength(1)
      expect(audit.rows[0].user_id).toBe(fixture.users.admin)
      expect(audit.rows[0].new_data.recipient_id).toBe(fixture.users.user)
      await catalog(pages.other, 'assignment')
      await expect(heading(pages.other, 'assignment')).toHaveCount(0)
    })
    await run('B28', 'Admin creates edits and confirms material draft with quantity two', pages.admin, async () => {
      await pages.admin.goto(`${baseUrl}/disbursements/new?items=${fixture.items.adminDraft.id}&type=material_issue`)
      await pages.admin.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
      await pages.admin.locator('#disbursement-recipient-name:visible').fill('UAT User')
      await pages.admin.locator('#disbursement-department-name:visible').fill('UAT Department')
      await pages.admin.locator('#disbursement-purpose:visible').fill('AI-UAT adminDraft')
      await pages.admin.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click()
      await state('adminDraft', 'draft')
      ids.adminDraft = (await doc('adminDraft')).id
      await pages.admin.goto(`${baseUrl}/disbursements/${ids.adminDraft}/edit`)
      await pages.admin.getByRole('spinbutton', { name: `จำนวนขอเบิก ${fixture.items.adminDraft.name}`, exact: true }).fill('2')
      await pages.admin.locator('#disbursement-purpose:visible').fill('AI-UAT adminDraft edited')
      await pages.admin.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click()
      await expect.poll(async () => (await doc('adminDraft'))?.purpose).toBe('AI-UAT adminDraft edited')
      await approve('adminDraft', 'confirmed')
      await expect(pages.admin.getByRole('dialog')).toHaveCount(0)
      await quantity('adminDraft', 8)
      const ledger = await owner.query('SELECT delta,balance_after,created_by FROM public.stock_movements WHERE item_id=$1', [fixture.items.adminDraft.id])
      expect(ledger.rows).toHaveLength(1)
      expect(Number(ledger.rows[0].delta)).toBe(-2)
      expect(Number(ledger.rows[0].balance_after)).toBe(8)
      expect(ledger.rows[0].created_by).toBe(fixture.users.admin)
    })
    await run('B19', 'No uncaught browser runtime errors across journeys', pages.user, async () => { expect(errors).toEqual([]) })
  } finally { await Promise.all(Object.values(pages).map(page => page.close())) }
  return results
}
