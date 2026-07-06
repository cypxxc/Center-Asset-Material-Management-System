import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const realAuthE2EEnabled = process.env.CAMMS_E2E_REAL_AUTH === 'true';

async function signIn(page: Page, email = 'admin@registry.s', password = 'admin1234') {
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

    await page.goto('/items');
    await expect(page.locator('body')).toContainText('CAMMS');
    await scanAccessibility(page, 'Items page');

    const itemName = `E2E Laptop ${Date.now()}`;

    await page.goto('/items?new=true');
    await expect(page.locator('input[name="item_name"]')).toBeVisible();
    await page.locator('input[name="item_name"]').fill(itemName);
    await page.locator('input[name="quantity"]').fill('1');
    await page.locator('select[name="status"]').selectOption('active');
    await page.locator('.new-item-sheet-dialog button[type="submit"]').click();

    await expect(page.locator(`text=${itemName}`).first()).toBeVisible({ timeout: 15_000 });

    await page.locator(`text=${itemName}`).first().click();
    const editLink = page.locator('a[href$="/edit"]').first();
    await expect(editLink).toBeVisible();
    await editLink.click();

    await expect(page.locator('input[name="quantity"]')).toBeVisible();
    await page.locator('input[name="quantity"]').fill('5');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/items\/[a-f0-9-]+/);
    await expect(page.locator('body')).toContainText('5');

    await page.goto('/items');
    await page.locator(`text=${itemName}`).first().click();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.locator('button').filter({ hasText: /ลบ|Delete/i }).first().click();
    await page.waitForURL(/\/items/);
    await expect(page.locator(`tr:has-text("${itemName}")`)).not.toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('body')).toContainText('CAMMS');
  });
});
