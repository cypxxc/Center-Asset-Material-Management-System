import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const realAuthE2EEnabled = process.env.CAMMS_E2E_REAL_AUTH === 'true';

async function signIn(
  page: Page,
  email = process.env.CAMMS_E2E_ADMIN_ID ?? 'admin@camms.local',
  password = process.env.CAMMS_E2E_ADMIN_PASSWORD ?? 'Admin@123456',
) {
  await page.goto('/login');
  await page.locator('input[name="id"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

async function scanAccessibility(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(result.violations, `${label} accessibility violations`).toEqual([]);
}

test.describe('CAMMS E2E critical journeys and accessibility', () => {
  test('unauthenticated user is redirected to login page', async ({ page }) => {
    await page.goto('/items');
    await page.waitForURL(/\/login/);

    await expect(page.locator('input[name="id"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('admin can log in, create, edit, soft-delete, and view settings', async ({ page }) => {
    test.skip(!realAuthE2EEnabled, 'Full critical journey requires CAMMS_E2E_REAL_AUTH=true and seed users.');

    await page.goto('/login');
    await scanAccessibility(page, 'Login page');

    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await scanAccessibility(page, 'Dashboard page');

    const itemsResponse = await page.goto('/items');
    expect(itemsResponse?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByRole('heading', { name: 'รายการทะเบียนครุภัณฑ์', exact: true, level: 1 })).toBeVisible();
    await scanAccessibility(page, 'Items page');

    const itemName = `E2E Laptop ${Date.now()}`;

    await page.goto('/items?new=true');
    const newItemDialog = page.locator('dialog.new-item-sheet-dialog[open]');
    await expect(newItemDialog.locator('input[name="item_name"]')).toBeVisible();
    await newItemDialog.locator('input[name="item_name"]').fill(itemName);
    await newItemDialog.locator('#quantity').fill('1');

    const unitCombobox = newItemDialog.locator('#unit_id');
    await unitCombobox.click();
    const unitOption = newItemDialog.locator('li[role="option"]').filter({ hasText: 'เครื่อง' }).first();
    await unitOption.waitFor({ state: 'visible' });
    await unitOption.click();

    await newItemDialog.getByRole('button', { name: 'บันทึกรายการ' }).click();

    await expect(page.locator(`text=${itemName}`).first()).toBeVisible({ timeout: 15_000 });

    const itemCheckbox = page.locator(`input[aria-label="เลือก ${itemName}"]`);
    await itemCheckbox.click();

    await page.getByRole('button', { name: 'แก้ไขข้อมูล' }).click();
    const editDialog = page.locator('dialog.new-item-sheet-dialog[open]');
    await expect(editDialog).toBeVisible();
    await editDialog.locator('#quantity').fill('5');
    await editDialog.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await expect(editDialog).toBeHidden();

    const isChecked = await itemCheckbox.isChecked();
    if (!isChecked) {
      await itemCheckbox.click();
    }
    await page.locator('button[aria-label="ยกเลิกรายการที่เลือก"]').click();
    await page.getByRole('button', { name: 'ยืนยันการลบ' }).click();
    await expect(page.locator(`tr:has-text("${itemName}")`)).not.toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: 'ตั้งค่าระบบ' })).toBeVisible();
  });
});
