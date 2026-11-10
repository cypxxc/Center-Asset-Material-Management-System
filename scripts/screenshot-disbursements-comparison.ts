import { chromium } from '@playwright/test';
import * as path from 'node:path';

async function main() {
  const artifactDir = 'C:\\Users\\chaya\\.gemini\\antigravity-cli\\brain\\779fd79b-86de-45e0-88ba-11b5cdf02526';
  const baseURL = 'http://localhost:3000';

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // Login
    await page.goto(`${baseURL}/login`);
    await page.locator('input[name="id"]').fill('admin@camms.local');
    await page.locator('input[name="password"]').fill('password');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Open /disbursements
    await page.goto(`${baseURL}/disbursements`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Screenshot of updated disbursements list
    await page.screenshot({ path: path.join(artifactDir, 'disbursements-updated-explorer.png') });

    // Open dropdown to show matching menu styling
    const statusDropdown = page.locator('button[title*="กรองตามสถานะ"], button[title*="สถานะ:"]').first();
    if (await statusDropdown.isVisible()) {
      await statusDropdown.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(artifactDir, 'disbursements-dropdown-open.png') });
    }

    console.log('✔ Captured updated screenshots successfully');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
