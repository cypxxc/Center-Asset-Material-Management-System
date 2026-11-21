import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const outDir = 'docs/uat/evidence-prod-build';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('[PROD BUILD E2E] Launching headless browser against http://localhost:3005...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = [];

  // 1. Unauthenticated redirect
  await page.goto('http://localhost:3005/dashboard');
  await page.waitForURL('**/login**');
  results.push({ name: 'Unauthenticated redirect to /login', pass: page.url().includes('/login') });
  await page.screenshot({ path: join(outDir, '01-prod-unauth-redirect.png') });

  // 2. Login as Admin
  await page.getByLabel('ชื่อผู้ใช้', { exact: true }).fill('admin@camms.local');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('Admin@123456');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  results.push({ name: 'Admin login redirects to /dashboard', pass: page.url().includes('/dashboard') });
  await page.screenshot({ path: join(outDir, '02-prod-admin-dashboard.png') });

  // 3. Inspect Dashboard KPI
  const heading = await page.getByRole('heading', { level: 1 }).textContent().catch(() => '');
  results.push({ name: 'Dashboard loaded with header', pass: heading.length > 0 });

  // 4. Navigate to Items (Assets)
  await page.goto('http://localhost:3005/items');
  await page.waitForSelector('table, [role="table"], h1, h2');
  results.push({ name: 'Items (Asset registry) loaded', pass: page.url().includes('/items') });
  await page.screenshot({ path: join(outDir, '03-prod-items-registry.png') });

  // 5. Navigate to Materials
  await page.goto('http://localhost:3005/materials');
  await page.waitForSelector('table, [role="table"], h1, h2');
  results.push({ name: 'Materials registry loaded', pass: page.url().includes('/materials') });
  await page.screenshot({ path: join(outDir, '04-prod-materials-registry.png') });

  // 6. Navigate to Disbursements
  await page.goto('http://localhost:3005/disbursements');
  await page.waitForSelector('h1, h2, nav');
  results.push({ name: 'Disbursements workspace loaded', pass: page.url().includes('/disbursements') });
  await page.screenshot({ path: join(outDir, '05-prod-disbursements.png') });

  // 7. Navigate to Central Items Catalog
  await page.goto('http://localhost:3005/central-items');
  await page.waitForSelector('h1, h2, [data-cart-card], input[type="search"]');
  results.push({ name: 'Central Items catalog loaded', pass: page.url().includes('/central-items') });
  await page.screenshot({ path: join(outDir, '06-prod-central-catalog.png') });

  // 8. Navigate to Reports
  await page.goto('http://localhost:3005/reports');
  await page.waitForSelector('h1, h2, button');
  results.push({ name: 'Reports page loaded', pass: page.url().includes('/reports') });
  await page.screenshot({ path: join(outDir, '07-prod-reports.png') });

  // 9. Navigate to Settings
  await page.goto('http://localhost:3005/settings');
  await page.waitForSelector('h1, h2, nav');
  results.push({ name: 'Settings page loaded', pass: page.url().includes('/settings') });
  await page.screenshot({ path: join(outDir, '08-prod-settings.png') });

  // 10. Admin Users
  await page.goto('http://localhost:3005/admin/users');
  await page.waitForSelector('table, [role="table"], h1, h2');
  results.push({ name: 'Admin users management loaded', pass: page.url().includes('/admin/users') });
  await page.screenshot({ path: join(outDir, '09-prod-admin-users.png') });

  // 11. Admin Audit Logs
  await page.goto('http://localhost:3005/admin/audit-logs');
  await page.waitForSelector('table, [role="table"], h1, h2');
  results.push({ name: 'Admin audit logs loaded', pass: page.url().includes('/admin/audit-logs') });
  await page.screenshot({ path: join(outDir, '10-prod-admin-audit-logs.png') });

  // 12. Health APIs
  const liveness = await (await fetch('http://localhost:3005/api/health/liveness')).json();
  results.push({ name: 'API Liveness check', pass: liveness.alive === true });

  const readiness = await (await fetch('http://localhost:3005/api/health/readiness')).json();
  results.push({ name: 'API Readiness check', pass: readiness.ready === true });

  console.log('Production Standalone E2E Results:');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

run().catch(console.error);
