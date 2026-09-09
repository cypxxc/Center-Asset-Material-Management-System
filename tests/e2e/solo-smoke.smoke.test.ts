import { expect, test } from '@playwright/test';

const realAuthE2EEnabled = process.env.CAMMS_E2E_REAL_AUTH === 'true';

async function signInForDraft(page: import('@playwright/test').Page) {
  const id = process.env.CAMMS_E2E_ADMIN_ID;
  const password = process.env.CAMMS_E2E_ADMIN_PASSWORD;
  if (!id?.trim() || !password?.trim()) throw new Error('Configure CAMMS_E2E_ADMIN_ID and CAMMS_E2E_ADMIN_PASSWORD for authenticated smoke tests');
  await page.goto('/login');
  await page.locator('input[name="id"]').fill(id);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('Solo developer browser smoke tests', () => {
  test('redirects unauthenticated dashboard requests to login', async ({ page }) => {
    await page.goto('/items');
    await page.waitForURL(/\/login/);

    await expect(page.locator('input[name="id"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('new item dialog uses standard centered layout and persists draft locally', async ({ page }) => {
    test.skip(!realAuthE2EEnabled, 'Draft dialog smoke requires CAMMS_E2E_REAL_AUTH=true and configured staging credentials.');

    await signInForDraft(page);
    await page.goto('/items?new=true');

    const dialog = page.locator('.new-item-sheet-dialog');
    const itemName = page.locator('input[name="item_name"]');
    const draftName = `Draft smoke ${Date.now()}`;

    await expect(dialog).toBeVisible();
    await expect(itemName).toBeVisible();

    await expect(dialog).toHaveCSS('align-items', 'center');
    await expect(dialog).toHaveCSS('justify-content', 'center');

    await itemName.fill(draftName);
    await page.waitForFunction(
      (expected) => {
        const raw = window.localStorage.getItem('omni-asset:new-item-draft');
        return raw ? JSON.parse(raw).item_name === expected : false;
      },
      draftName
    );

    await page.reload();
    await expect(page.locator('input[name="item_name"]')).toHaveValue(draftName);
  });
});
