import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'

const accounts = parse(readFileSync('.env.staging.accounts'))
// Connect to staging DB with superuser to verify raw table rows bypassing RLS
const dbPool = new Pool({
  connectionString: 'postgresql://camms_local:e1bf213c67012f68435e69ee08abd5bbdbcdfaa30b6245da974e4240a07c056e@127.0.0.1:15432/camms_staging',
})

test.describe('CAMMS Full-System AI UAT on Staging (Port 3001)', () => {
  test.afterAll(async () => {
    await dbPool.end()
  })

  // -------------------------------------------------------------
  // Module 1: Auth & Security Verification
  // -------------------------------------------------------------
  test.describe('Module 1: Authentication & Session', () => {
    test('TC-AUTH-01: Unauthenticated Redirect to /login', async ({ page }) => {
      await page.goto('/items')
      await page.waitForURL(/\/login/)
      await expect(page.locator('input[name="id"]')).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/01-unauth-redirect.png' })
    })

    test('TC-AUTH-02: Invalid Password Rejection and Alert', async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[name="id"]', accounts.UAT_ADMIN_EMAIL)
      await page.fill('input[name="password"]', 'WrongPassword123!')
      await page.click('button[type="submit"]')

      await expect(page.locator('[role="alert"]')).toBeVisible()
      await expect(page).toHaveURL(/\/login/)
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/02-login-rejected.png' })
    })
  })

  // -------------------------------------------------------------
  // Module 2: Dashboard Overview
  // -------------------------------------------------------------
  test.describe('Module 2: Dashboard', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/admin.json' })

    test('TC-DASH-01: Dashboard KPI Cards & Summary Loaded from Staging DB', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('h1:has-text("ภาพรวมพัสดุ")')).toBeVisible()
      await expect(page.locator('text=มูลค่าสินทรัพย์รวม')).toBeVisible()
      await expect(page.locator('text=฿73,250')).toBeVisible()
      await expect(page.locator('text=3 รายการ')).toBeVisible()
      await expect(page.locator('text=ผู้ดูแลระบบ UAT').first()).toBeVisible()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/03-dashboard-admin.png', fullPage: true })
    })
  })

  // -------------------------------------------------------------
  // Module 3: Items & Depreciation
  // -------------------------------------------------------------
  test.describe('Module 3: Items Management & Search', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/staff.json' })

    test('TC-ITEM-01: Items List and Search Filtering', async ({ page }) => {
      await page.goto('/items')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('text=กระดาษถ่ายเอกสาร A4').first()).toBeVisible()
      await expect(page.locator('text=Dell Latitude 5430').first()).toBeVisible()
      await expect(page.locator('text=Lenovo ThinkPad L14').first()).toBeVisible()

      // Search for Dell
      const searchInput = page.locator('input[placeholder*="ค้นหา"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('Dell')
        await page.waitForTimeout(500)
        await expect(page.locator('text=Dell Latitude 5430').first()).toBeVisible()
        await expect(page.locator('text=Lenovo ThinkPad')).toHaveCount(0)
      }

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/04-items-list.png' })
    })

    test('TC-ITEM-02: Item Detail Displays Staging Metadata', async ({ page }) => {
      await page.goto('/items')
      await page.waitForLoadState('domcontentloaded')

      // Click row to inspect
      await page.click('text=Dell Latitude 5430')

      // Check item metadata in UI
      await expect(page.locator('text=CAMMS-AST-2026-001').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('text=Dell Latitude 5430').first()).toBeVisible()
      await expect(page.locator('div, p, span, h1, h2, h3').filter({ hasText: 'คลังพัสดุหลัก' }).first()).toBeVisible()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/05-item-detail.png' })
    })
  })

  test.describe('Module 3: Items Viewer Restriction', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/viewer.json' })

    test('TC-ITEM-03: Viewer Cannot Create or Edit Items', async ({ page }) => {
      await page.goto('/items')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('a:has-text("เพิ่มพัสดุ"), button:has-text("เพิ่มพัสดุ")')).toHaveCount(0)
      await expect(page.locator('text=ผู้ดูข้อมูล UAT').first()).toBeVisible()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/06-viewer-items-readonly.png' })
    })
  })

  // -------------------------------------------------------------
  // Module 4: Disbursements Subsystem (Core Workflows)
  // -------------------------------------------------------------
  test.describe('Module 4: Disbursements', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/staff.json' })

    test('TC-DISB-01: Scenario 1 - Material Issue with Real Stock Deduction in DB', async ({ page }) => {
      await page.goto('/disbursements/new')
      await page.waitForLoadState('domcontentloaded')

      await page.selectOption('select', 'material_issue')
      await page.fill('input[placeholder*="สมชาย"]', 'นายสมชาย ผู้รับวัสดุ UAT')
      await page.fill('input[placeholder*="กองบริหาร"]', 'ฝ่ายเทคโนโลยีสารสนเทศ UAT')
      await page.fill('textarea[placeholder*="ระบุเหตุผล"]', 'เพื่อใช้ในงานทดสอบ Full-System UAT')

      // Click "เพิ่มรายการ" to add row (Double A is selected by default as first material)
      await page.click('button:has-text("เพิ่มรายการ")')
      await page.locator('input[type="number"]').fill('5')

      // Save draft
      await page.click('button:has-text("บันทึกฉบับร่าง")')
      await page.waitForURL(/\/disbursements\/[a-f0-9-]+/)

      await expect(page.locator('h1').first()).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/07-disb-draft.png' })

      // Confirm document
      await page.click('button:has-text("ยืนยันการเบิก-จ่าย")')
      await page.click('button:has-text("ยืนยันทำรายการ")')

      // Wait for success toast with official document number
      await expect(page.locator('text=ยืนยันการเบิก-จ่ายสำเร็จ')).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/08-disb-confirmed.png' })

      // Verify Staging Database Stock Deduction
      const itemDb = await dbPool.query<{ quantity: number }>("SELECT quantity FROM public.items WHERE item_name LIKE '%Double A%'")
      expect(itemDb.rows[0].quantity).toBe(45) // 50 - 5 = 45

      const stockMove = await dbPool.query<{ delta: number; balance_after: number }>(
        'SELECT delta, balance_after FROM public.stock_movements ORDER BY created_at DESC LIMIT 1'
      )
      expect(stockMove.rows[0].delta).toBe(-5)
      expect(stockMove.rows[0].balance_after).toBe(45)
    })

    test('TC-DISB-02: Scenario 3 & 4 - Asset Borrow, Active Borrow Status, and Full Return', async ({ page }) => {
      await page.goto('/disbursements/new')
      await page.waitForLoadState('domcontentloaded')

      await page.selectOption('select', 'asset_borrow')
      await page.fill('input[type="date"]', '2026-11-20')
      await page.fill('input[placeholder*="สมชาย"]', 'นางสาวสมศรี ผู้ยืม UAT')
      await page.fill('input[placeholder*="กองบริหาร"]', 'กลุ่มงานวิจัยและพัฒนา UAT')
      await page.fill('textarea[placeholder*="ระบุเหตุผล"]', 'ยืมเครื่องโน้ตบุ๊กสำหรับจัดอบรมสัมมนา UAT')

      // Click "เพิ่มรายการ"
      await page.click('button:has-text("เพิ่มรายการ")')

      // Save draft
      await page.click('button:has-text("บันทึกฉบับร่าง")')
      await page.waitForURL(/\/disbursements\/[a-f0-9-]+/)

      // Confirm document
      await page.click('button:has-text("ยืนยันการเบิก-จ่าย")')
      await page.click('button:has-text("ยืนยันทำรายการ")')

      // Wait for confirmation to finish and show active_borrow
      await expect(page.locator('text=กำลังยืม').first()).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/09-borrow-active.png' })

      // Click Return (บันทึกคืน) in line items table
      await page.click('button:has-text("บันทึกคืน")')
      // Submit return modal
      await expect(page.locator('text=บันทึกรับคืนครุภัณฑ์')).toBeVisible({ timeout: 10_000 })
      await page.locator('form button[type="submit"]:has-text("บันทึกรับคืน")').click()

      // Success notification
      await expect(page.locator('text=บันทึกรับคืนพัสดุสำเร็จ')).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/10-borrow-returned.png' })

      // Verify custody log in DB
      const custodyDb = await dbPool.query<{ action: string }>(
        "SELECT action FROM public.asset_custody_logs WHERE action = 'return' ORDER BY created_at DESC LIMIT 1"
      )
      expect(custodyDb.rows[0].action).toBe('return')
    })

    test('TC-DISB-03: Scenario 5 - Draft Document Cancellation', async ({ page }) => {
      await page.goto('/disbursements/new')
      await page.waitForLoadState('domcontentloaded')

      await page.selectOption('select', 'material_issue')
      await page.fill('input[placeholder*="สมชาย"]', 'ผู้ขอยกเลิก')
      await page.fill('input[placeholder*="กองบริหาร"]', 'ฝ่ายทดสอบ')
      await page.fill('textarea[placeholder*="ระบุเหตุผล"]', 'เอกสารทดสอบการยกเลิก')
      await page.click('button:has-text("เพิ่มรายการ")')

      await page.click('button:has-text("บันทึกฉบับร่าง")')
      await page.waitForURL(/\/disbursements\/[a-f0-9-]+/)

      // Click "ยกเลิกร่าง"
      await page.click('button:has-text("ยกเลิกร่าง")')
      await page.click('button:has-text("ยืนยันยกเลิกร่าง")')

      // Expect Cancelled badge
      await expect(page.locator('text=ยกเลิกแล้ว').first()).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/11-disb-cancelled.png' })
    })

    test('TC-DISB-04: Scenario 8 - Print Voucher Verification', async ({ page }) => {
      await page.goto('/disbursements')
      await page.waitForLoadState('domcontentloaded')

      // Open the confirmed material issue
      await page.click('tr:has-text("นายสมชาย ผู้รับวัสดุ UAT") a:has-text("ดูรายละเอียด")')
      await page.waitForURL(/\/disbursements\/[a-f0-9-]+/)

      // Print voucher button
      const printBtn = page.locator('button:has-text("พิมพ์ใบเบิก-จ่าย")')
      await expect(printBtn).toBeVisible()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/12-voucher-confirmed.png' })
    })
  })

  // -------------------------------------------------------------
  // Module 5 & 6: Locations & Settings (Metadata)
  // -------------------------------------------------------------
  test.describe('Module 5 & 6: Locations & Settings', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/admin.json' })

    test('TC-LOC-01: Locations View Loaded from Staging', async ({ page }) => {
      await page.goto('/locations')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('h1:has-text("สถานที่จัดเก็บ")')).toBeVisible()
      await expect(page.locator('button:has-text("คลังพัสดุหลัก")')).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/13-locations.png' })
    })

    test('TC-SETT-01: Settings Categories and Units View', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('text=ตั้งค่าระบบและมิติตัวเลือกพัสดุ')).toBeVisible()
      await expect(page.locator('text=หมวดหมู่พัสดุ').first()).toBeVisible()
      await expect(page.locator('text=สถานที่จัดตั้ง').first()).toBeVisible()
      await expect(page.locator('text=หน่วยนับ').first()).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/14-settings.png' })
    })
  })

  // -------------------------------------------------------------
  // Module 7: Reports
  // -------------------------------------------------------------
  test.describe('Module 7: Reports & Exports', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/admin.json' })

    test('TC-REP-01: Reports Overview and Excel Export Button', async ({ page }) => {
      await page.goto('/reports')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.locator('h1:has-text("รายงานพัสดุ")')).toBeVisible()
      await expect(page.locator('button:has-text("ดาวน์โหลด Excel")')).toBeVisible()
      await expect(page.locator('text=มูลค่าทรัพย์สินทั้งหมด')).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/15-reports.png' })
    })
  })

  // -------------------------------------------------------------
  // Module 8: Admin & RBAC Security Boundaries
  // -------------------------------------------------------------
  test.describe('Module 8: Admin & RBAC Security Boundaries', () => {
    test('TC-ADMIN-01: Admin Can Access Users and Audit Logs', async ({ browser }) => {
      const context = await browser.newContext({ storageState: 'tests/e2e/staging/.auth/admin.json' })
      const page = await context.newPage()

      await page.goto('/admin/users')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('text=ผู้ดูแลระบบ UAT').first()).toBeVisible()
      await expect(page.locator('text=เจ้าหน้าที่พัสดุ UAT').first()).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/16-admin-users.png' })

      await page.goto('/admin/audit-logs')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { name: /ประวัติ/ })).toBeVisible()
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/17-admin-audit-logs.png' })

      await context.close()
    })

    test('TC-ADMIN-02: Staff Is Blocked from /admin/users', async ({ browser }) => {
      const context = await browser.newContext({ storageState: 'tests/e2e/staging/.auth/staff.json' })
      const page = await context.newPage()

      await page.goto('/admin/users')
      await page.waitForTimeout(1000)

      const blocked = page.url().includes('/dashboard') || page.url().includes('/login') || (await page.locator('text=403').count()) > 0 || (await page.locator('text=ไม่มีสิทธิ์').count()) > 0
      expect(blocked).toBe(true)

      await context.close()
    })

    test('TC-ADMIN-03: Viewer Is Blocked from /admin/users', async ({ browser }) => {
      const context = await browser.newContext({ storageState: 'tests/e2e/staging/.auth/viewer.json' })
      const page = await context.newPage()

      await page.goto('/admin/users')
      await page.waitForTimeout(1000)

      const blocked = page.url().includes('/dashboard') || page.url().includes('/login') || (await page.locator('text=403').count()) > 0 || (await page.locator('text=ไม่มีสิทธิ์').count()) > 0
      expect(blocked).toBe(true)

      await context.close()
    })
  })
})
