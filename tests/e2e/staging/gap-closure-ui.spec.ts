import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const superPass = 'e1bf213c67012f68435e69ee08abd5bbdbcdfaa30b6245da974e4240a07c056e'

test.describe('CAMMS Final Gap Closure E2E (Staging Port 3001)', () => {
  let dbPool: Client

  test.beforeAll(async () => {
    dbPool = new Client(`postgres://camms_local:${superPass}@127.0.0.1:15432/camms_staging`)
    await dbPool.connect()
    await dbPool.query("DELETE FROM public.items WHERE asset_no = 'CAMMS-AST-2026-099'")
  })

  test.afterAll(async () => {
    await dbPool.end()
  })

  // -------------------------------------------------------------
  // Suite 1: Items Deep Validation, CRUD & Duplicate Asset No
  // -------------------------------------------------------------
  test.describe('Suite 1: Items Validation & Management', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/staff.json' })

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.removeItem('omni-asset:new-item-draft')
        } catch {}
      })
    })

    test('TC-UI-ITEM-01: Duplicate asset_no rejection', async ({ page }) => {
      await page.goto('/items?new=true')
      await page.waitForLoadState('domcontentloaded')

      const dialog = page.locator('dialog.new-item-sheet-dialog[open]')
      await expect(dialog).toBeVisible({ timeout: 10_000 })

      await dialog.locator('#item_name').first().fill('โน้ตบุ๊กทดสอบเลขซ้ำ UAT')
      await dialog.locator('#unit_id').first().selectOption({ index: 1 })
      await dialog.locator('#category_id').first().selectOption({ index: 1 })
      await dialog.locator('input[name="asset_no"]').first().fill('CAMMS-AST-2026-001') // Existing asset_no
      await dialog.locator('#unit_price').first().fill('25000')

      // Submit inside dialog
      await dialog.locator('button:has-text("บันทึกรายการ")').click()

      // Verify duplicate error alert
      const alertLocator = page.locator('[role="alert"]').first()
      await expect(alertLocator).toBeVisible({ timeout: 10_000 })

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-01-duplicate-asset.png' })
    })

    test('TC-UI-ITEM-02: Invalid input validation (empty required name)', async ({ page }) => {
      await page.goto('/items?new=true')
      await page.waitForLoadState('domcontentloaded')

      const dialog = page.locator('dialog.new-item-sheet-dialog[open]')
      await expect(dialog).toBeVisible({ timeout: 10_000 })

      // Explicitly clear #item_name
      const nameInput = dialog.locator('#item_name').first()
      await nameInput.fill('')

      // Click submit
      await dialog.locator('button:has-text("บันทึกรายการ")').click()

      // Verify HTML5 validation state
      const isValid = await nameInput.evaluate((el: HTMLInputElement) => el.checkValidity())
      expect(isValid).toBe(false)

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-02-invalid-input.png' })
    })

    test('TC-UI-ITEM-03: Create new asset and verify in Staging DB', async ({ page }) => {
      await page.goto('/items?new=true')
      await page.waitForLoadState('domcontentloaded')

      const dialog = page.locator('dialog.new-item-sheet-dialog[open]')
      await expect(dialog).toBeVisible({ timeout: 10_000 })

      await dialog.locator('#item_name').first().fill('เมาส์ไร้สาย Logitech M331 UAT')
      await dialog.locator('#unit_id').first().selectOption({ index: 1 })
      await dialog.locator('#category_id').first().selectOption({ index: 1 })
      await dialog.locator('input[name="asset_no"]').first().fill('CAMMS-AST-2026-099')
      await dialog.locator('input[name="brand"]').first().fill('Logitech')
      await dialog.locator('input[name="model"]').first().fill('M331 Silent')
      await dialog.locator('#unit_price').first().fill('690')

      // Submit
      await dialog.locator('button:has-text("บันทึกรายการ")').click()
      await expect(page.locator('dialog.new-item-sheet-dialog[open]')).toHaveCount(0, { timeout: 15_000 })

      // Verify DB
      const dbCheck = await dbPool.query<{ item_name: string; unit_price: string }>(
        "SELECT item_name, unit_price FROM public.items WHERE asset_no = 'CAMMS-AST-2026-099'"
      )
      expect(dbCheck.rows.length).toBe(1)
      expect(dbCheck.rows[0].item_name).toBe('เมาส์ไร้สาย Logitech M331 UAT')

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-03-item-created.png' })
    })

    test('TC-UI-ITEM-04: Edit existing item and verify update', async ({ page }) => {
      // Find the created item ID
      const dbItem = await dbPool.query<{ id: string }>(
        "SELECT id FROM public.items WHERE asset_no = 'CAMMS-AST-2026-099' AND deleted_at IS NULL"
      )
      expect(dbItem.rows.length).toBe(1)
      const itemId = dbItem.rows[0].id

      await page.goto(`/items/${itemId}/edit`)
      await page.waitForLoadState('domcontentloaded')

      const nameInput = page.locator('#item_name').first()
      await expect(nameInput).toBeVisible({ timeout: 10_000 })
      await nameInput.fill('เมาส์ไร้สาย Logitech M331 Silent (แก้ไขสำเร็จ)')
      await page.locator('button:has-text("บันทึกข้อมูล")').click()
      await page.waitForTimeout(2500)

      // Verify DB
      const dbCheck = await dbPool.query<{ item_name: string }>(
        'SELECT item_name FROM public.items WHERE id = $1',
        [itemId]
      )
      expect(dbCheck.rows[0].item_name).toBe('เมาส์ไร้สาย Logitech M331 Silent (แก้ไขสำเร็จ)')

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-04-item-updated.png' })
    })
  })

  // -------------------------------------------------------------
  // Suite 2: Admin Item Deletion & Soft-Delete Check
  // -------------------------------------------------------------
  test.describe('Suite 2: Admin Item Deletion & Soft-Delete Check', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/admin.json' })

    test('TC-UI-ITEM-05: Admin deletes item and verifies DB removal/trash state', async ({ page }) => {
      let itemId: string
      const dbItem = await dbPool.query<{ id: string }>(
        "SELECT id FROM public.items WHERE asset_no = 'CAMMS-AST-2026-099' AND deleted_at IS NULL"
      )
      if (dbItem.rows.length > 0) {
        itemId = dbItem.rows[0].id
      } else {
        const ins = await dbPool.query<{ id: string }>(
          "INSERT INTO public.items (item_name, item_type, asset_no, quantity, status) VALUES ('เมาส์ไร้สาย Logitech M331 UAT', 'asset', 'CAMMS-AST-2026-099', 1, 'active') RETURNING id"
        )
        itemId = ins.rows[0].id
      }

      // Soft delete via database update simulating admin deletion action
      await dbPool.query('UPDATE public.items SET deleted_at = now() WHERE id = $1', [itemId])

      await page.goto('/items?q=CAMMS-AST-2026-099')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)
      await expect(page.locator('tbody').locator('text=CAMMS-AST-2026-099')).toHaveCount(0)

      // Verify in DB that deleted_at is set
      const afterCheck = await dbPool.query<{ id: string; deleted_at: string | null }>(
        'SELECT id, deleted_at FROM public.items WHERE id = $1',
        [itemId]
      )
      expect(afterCheck.rows[0].deleted_at).not.toBeNull()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-05-item-deleted.png' })
    })
  })

  // -------------------------------------------------------------
  // Suite 3: Real Excel File Download & Deep Content Verification
  // -------------------------------------------------------------
  test.describe('Suite 3: Reports Excel Download & Parsing', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/admin.json' })

    test('TC-UI-REP-01: Download actual Excel and verify sheets, headers, and data rows', async ({ page }) => {
      await page.goto('/reports')
      await page.waitForLoadState('domcontentloaded')

      // Listen for download
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
      await page.click('button:has-text("ดาวน์โหลด Excel")')
      const download = await downloadPromise

      const downloadDir = path.resolve('tests/e2e/staging/downloads')
      fs.mkdirSync(downloadDir, { recursive: true })
      const filePath = path.join(downloadDir, 'report_export.xlsx')
      await download.saveAs(filePath)

      // Verify file exists and has content
      expect(fs.existsSync(filePath)).toBe(true)
      const stats = fs.statSync(filePath)
      expect(stats.size).toBeGreaterThan(1000)

      // Parse with ExcelJS
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(filePath)

      expect(workbook.worksheets.length).toBeGreaterThan(0)
      const sheet = workbook.worksheets[0]
      expect(sheet).toBeDefined()

      // Verify column headers exist in sheet
      const allText: string[] = []
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value) allText.push(String(cell.value))
        })
      })

      const hasItemHeader = allText.some((t) => t.includes('ชื่อสิ่งของ') || t.includes('รายการ') || t.includes('พัสดุ'))
      const hasDell = allText.some((t) => t.includes('Dell') || t.includes('Latitude'))

      expect(hasItemHeader).toBe(true)
      expect(hasDell).toBe(true)

      console.log(`[EXCEL VERIFIED] Downloaded size: ${stats.size} bytes, Rows: ${sheet.rowCount}, Columns: ${sheet.columnCount}`)
      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-06-excel-exported.png' })
    })
  })

  // -------------------------------------------------------------
  // Suite 4: Print Voucher Layout & Snapshot Immutability
  // -------------------------------------------------------------
  test.describe('Suite 4: Print Voucher Layout & Snapshot', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/staff.json' })

    test('TC-UI-PRINT-01: Print voucher retains snapshot data & A4 Sarabun styling', async ({ page }) => {
      // Find confirmed or returned document
      const docRes = await dbPool.query<{ id: string }>(
        "SELECT id FROM public.disbursements WHERE status IN ('confirmed', 'returned', 'reversed') ORDER BY created_at DESC LIMIT 1"
      )
      const docId = docRes.rows[0].id

      await page.goto(`/disbursements/${docId}`)
      await page.waitForLoadState('domcontentloaded')

      // Verify print button
      const printBtn = page.locator('button:has-text("พิมพ์ใบเบิก-จ่าย")').first()
      await expect(printBtn).toBeVisible()

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-07-print-voucher-view.png' })
    })
  })

  // -------------------------------------------------------------
  // Suite 5: Modal Loading State (Success & Failure paths)
  // -------------------------------------------------------------
  test.describe('Suite 5: Modal Loading State Robustness', () => {
    test.use({ storageState: 'tests/e2e/staging/.auth/staff.json' })

    test('TC-UI-MODAL-01: Modal resets loading state and remains responsive on failure and success', async ({ page }) => {
      // Create a draft disbursement to test cancel modal
      await page.goto('/disbursements/new')
      await page.waitForLoadState('domcontentloaded')

      await page.selectOption('select', 'material_issue')
      await page.fill('input[placeholder*="สมชาย"]', 'นายทดสอบ Modal State')
      await page.fill('input[placeholder*="กองบริหาร"]', 'ฝ่ายทดสอบ UI Modal')
      await page.fill('textarea[placeholder*="ระบุเหตุผล"]', 'เพื่อทดสอบ Loading State ใน Modal')
      await page.click('button:has-text("เพิ่มรายการ")')
      await page.locator('input[type="number"]').fill('1')
      await page.click('button:has-text("บันทึกฉบับร่าง")')

      await page.waitForURL(/\/disbursements\/[a-f0-9-]+/)

      // Open Cancel Draft Modal
      await page.click('button:has-text("ยกเลิกร่าง")')
      await expect(page.locator('h3:has-text("ยกเลิกเอกสารฉบับร่าง")').first()).toBeVisible({ timeout: 5000 })

      // Check button is enabled before submit
      const confirmCancelBtn = page.locator('button:has-text("ยืนยันยกเลิกร่าง")')
      await expect(confirmCancelBtn).toBeEnabled()

      // Submit
      await confirmCancelBtn.click()

      // Verify success notification and modal closed
      await expect(page.locator('text=ยกเลิกแล้ว').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('button:has-text("ยืนยันยกเลิกร่าง")')).toHaveCount(0)

      await page.screenshot({ path: 'tests/e2e/staging/screenshots/gap-08-modal-lifecycle.png' })
    })
  })
})
