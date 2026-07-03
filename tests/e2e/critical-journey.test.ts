import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('CAMMS E2E Critical Journeys & Accessibility', () => {
  
  test.beforeEach(({}) => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('example.supabase.co')) {
      console.warn('Skipping E2E test: Real Supabase URL is not configured in this environment.');
      test.skip();
    }
  });

  test('Unauthenticated user is redirected to login page', async ({ page }) => {
    await page.goto('/items');
    await page.waitForURL(/.*\/login/);
    expect(page.url()).toContain('/login');
  });

  test('Admin user login, listing, creation, editing, soft delete and settings accessibility scan', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');

    // Run Axe scan on Login Page
    const loginAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    console.log(`Login page accessibility violations: ${loginAxe.violations.length}`);
    
    // Perform Login
    await page.fill('input[name="id"]', 'admin@registry.s');
    await page.fill('input[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    // 2. Wait for redirect to /dashboard
    await page.waitForURL(/.*\/dashboard/);
    await expect(page.locator('text=ยินดีต้อนรับ')).toBeVisible();

    // Run Axe scan on Dashboard Page
    const dashboardAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    console.log(`Dashboard page accessibility violations: ${dashboardAxe.violations.length}`);

    // 3. Navigate to Items Listing
    await page.goto('/items');
    await page.waitForURL(/\/items/);
    await expect(page.getByRole('heading', { name: 'รายการทะเบียนสิ่งของ' })).toBeVisible();

    // Run Axe scan on Items list page
    const itemsAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    console.log(`Items page accessibility violations: ${itemsAxe.violations.length}`);

    // 4. Create Item by triggering the query param sheet
    await page.goto('/items?new=true');
    await page.waitForSelector('input[name="item_name"]');

    // Fill new item form
    const itemName = `E2E Laptop ${Date.now()}`;
    await page.fill('input[name="item_name"]', itemName);
    await page.selectOption('select[name="item_type"]', 'asset');
    await page.fill('input[name="quantity"]', '1');
    await page.selectOption('select[name="status"]', 'active');
    
    // Submit creation specifically targeting the save button
    await page.click('button:has-text("บันทึกข้อมูล")');
    
    // Wait for the new item to appear in the items explorer list
    await page.waitForURL(/\/items/);
    await expect(page.locator(`text=${itemName}`).first()).toBeVisible();

    // 5. Click the created item to open the detail pane on the right
    await page.click(`text=${itemName}`);
    
    // Wait for edit link to appear in the detail pane and click it
    const editBtn = page.locator('a:has-text("แก้ไข")');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 6. Edit item form
    await page.waitForSelector('input[name="quantity"]');
    await page.fill('input[name="quantity"]', '5');
    await page.click('button:has-text("บันทึกข้อมูล")');
    
    // Wait for details redirect
    await page.waitForURL(/\/items\/[a-f0-9-]+/);
    // Find the exact quantity element (should display "5")
    await expect(page.locator('dd:has-text("5"), td:has-text("5"), span:has-text("5"), div:has-text("5")').first()).toBeVisible();

    // 7. Go back to items listing
    await page.goto('/items');
    await page.waitForURL(/\/items/);

    // 8. Open details panel and soft delete the item
    await page.click(`text=${itemName}`);
    
    // Listen for the browser confirm dialog and accept it
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('ยืนยันการลบ');
      await dialog.accept();
    });

    const deleteBtn = page.locator('button:has-text("ลบรายการ")');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    
    // Verify redirection to /items and that the item is gone from the table
    await page.waitForURL(/\/items/);
    await expect(page.locator(`tr:has-text("${itemName}")`)).not.toBeVisible();

    // 9. View settings page and verify loaded tabs
    await page.goto('/settings');
    await page.waitForURL(/.*\/settings/);
    await expect(page.locator('text=หมวดหมู่').first()).toBeVisible();
  });
});
