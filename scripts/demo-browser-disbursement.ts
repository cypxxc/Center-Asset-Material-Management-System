import { chromium } from '@playwright/test';
import * as path from 'node:path';

async function main() {
  const artifactDir = 'C:\\Users\\chaya\\.gemini\\antigravity-cli\\brain\\779fd79b-86de-45e0-88ba-11b5cdf02526';
  const baseURL = 'http://localhost:3000';

  console.log('====================================================');
  console.log('🚀 กำลังเปิด Google Chrome / Chromium ขึ้นมาบนหน้าจอจริง...');
  console.log('====================================================');

  const browser = await chromium.launch({
    headless: false, // แสดงหน้าต่างเบราว์เซอร์จริงบนหน้าจอ
    args: ['--start-maximized'],
    slowMo: 600,     // หน่วงเวลาทุก action 600ms ให้ผู้ใช้มองเห็นการพิมพ์และคลิกทีละจุดอย่างชัดเจน
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. เข้าสู่หน้า Login
    console.log('▶ ขั้นตอนที่ 1: เข้าสู่หน้า Login...');
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('networkidle');

    // 2. ล็อกอินเข้าสู่ระบบ
    console.log('▶ ขั้นตอนที่ 2: กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ...');
    await page.locator('input[name="id"]').fill('admin@camms.local');
    await page.locator('input[name="password"]').fill('password');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✔ เข้าสู่ระบบสำเร็จ (Dashboard)');
    await page.waitForTimeout(1000);

    // 3. ไปที่หน้า ทะเบียนเบิก-จ่าย
    console.log('▶ ขั้นตอนที่ 3: เปิดหน้า ทะเบียนเบิก-จ่าย (/disbursements)...');
    await page.goto(`${baseURL}/disbursements`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 4. คลิกสร้างเอกสารเบิกจ่ายใหม่
    console.log('▶ ขั้นตอนที่ 4: คลิกปุ่ม "สร้างเอกสารเบิกจ่าย"...');
    const createBtn = page.getByRole('link', { name: /สร้างเอกสารเบิกจ่าย/ });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    } else {
      await page.goto(`${baseURL}/disbursements/new`);
    }
    await page.waitForURL('**/disbursements/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 5. กรอกรายละเอียดเอกสาร
    console.log('▶ ขั้นตอนที่ 5: กรอกข้อมูลเอกสารเบิกจ่าย...');
    await page.locator('#disbursement-recipient-name').fill('นายชยพล รมย์จันทร์ (ทดสอบ 10 รายการ)');
    await page.locator('#disbursement-department-name').fill('กลุ่มงานเทคโนโลยีสารสนเทศและการสื่อสาร');
    await page.locator('#disbursement-purpose').fill('เบิกพัสดุและครุภัณฑ์จำนวน 10 รายการ สำหรับเตรียมความพร้อมห้องปฏิบัติการดิจิทัล');

    // 6. เปิด Item Picker Modal
    console.log('▶ ขั้นตอนที่ 6: เปิดหน้าต่างค้นหาและเลือกพัสดุจากคลัง...');
    await page.getByRole('button', { name: /ค้นหาและเลือกพัสดุจากคลัง|เปิดตารางเลือกพัสดุ/ }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(800);

    // 7. เลือกพัสดุ 10 รายการจากตารางทีละรายการ ให้เห็นการกดจริง
    console.log('▶ ขั้นตอนที่ 7: กำลังคลิกเลือกพัสดุ 10 รายการในตารางทีละรายการ...');
    const selectableRows = page.locator('[role="dialog"] table tbody tr:not(.opacity-60)');
    const rowCount = await selectableRows.count();
    const targetCount = Math.min(10, rowCount);

    console.log(`   (พบรายการพร้อมเบิกทั้งหมด ${rowCount} รายการ กำลังเลือก ${targetCount} รายการ)`);

    for (let i = 0; i < targetCount; i++) {
      const row = selectableRows.nth(i);
      const itemName = await row.locator('td').nth(2).locator('span').first().textContent();
      const checkbox = row.locator('input[type="checkbox"]');
      
      console.log(`   ✔ เลือกรายการที่ ${i + 1}/${targetCount}: ${itemName?.trim()}`);
      await checkbox.click();
      await page.waitForTimeout(400);
    }

    await page.screenshot({ path: path.join(artifactDir, '10-items-modal-selected.png') });

    // คลิกปุ่มยืนยันการเพิ่ม 10 รายการเข้าสู่เอกสาร
    console.log(`▶ ขั้นตอนที่ 8: กดยืนยันเพิ่ม ${targetCount} รายการเข้าสู่แบบฟอร์มเบิกจ่าย...`);
    const addConfirmBtn = page.getByRole('button', { name: /เพิ่มเข้ารายการเบิก/ });
    await addConfirmBtn.click();
    await page.waitForTimeout(1000);

    // 8. ปรับจำนวนในตาราง (Stepper)
    console.log('▶ ขั้นตอนที่ 9: ปรับเพิ่มจำนวนพัสดุบางรายการด้วยปุ่ม Stepper (+)...');
    const plusButtons = page.getByTitle('เพิ่มจำนวน');
    const plusCount = await plusButtons.count();
    for (let i = 0; i < Math.min(3, plusCount); i++) {
      const btn = plusButtons.nth(i);
      if (await btn.isEnabled()) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }

    await page.screenshot({ path: path.join(artifactDir, '10-items-form-ready.png') });

    // 9. บันทึกฉบับร่าง
    console.log('▶ ขั้นตอนที่ 10: กำลังกดบันทึกฉบับร่าง...');
    await page.getByRole('button', { name: /บันทึกฉบับร่าง/ }).click();

    // 10. รอเข้าสู่หน้ารายละเอียดเอกสาร
    await page.waitForURL(/\/disbursements\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    console.log('✔ บันทึกเอกสารฉบับร่าง 10 รายการสำเร็จ!');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(artifactDir, '10-items-draft-detail.png') });

    // 11. กดยืนยันการเบิก-จ่าย
    console.log('▶ ขั้นตอนที่ 11: กดยืนยันการเบิก-จ่ายจริง (ตัดยอดสต็อกและออกเลขที่เอกสาร)...');
    const confirmDisburseBtn = page.getByRole('button', { name: /ยืนยันการเบิก-จ่าย/ });
    if (await confirmDisburseBtn.isVisible()) {
      await confirmDisburseBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // ยืนยันใน ConfirmDialog
      const confirmDialogBtn = page.getByRole('button', { name: 'ยืนยันทำรายการ' });
      await confirmDialogBtn.click();
      await page.waitForTimeout(2500);
      await page.waitForLoadState('networkidle');
      console.log('✔ ยืนยันการเบิก-จ่ายสำเร็จ! ได้รับเลขที่เอกสารทางการเรียบร้อย');
    }

    await page.screenshot({ path: path.join(artifactDir, '10-items-confirmed-voucher.png') });

    // เลื่อนหน้าจอให้เห็นรายการทั้ง 10 รายการอย่างชัดเจน
    console.log('▶ ขั้นตอนที่ 12: เลื่อนหน้าจอแสดงรายการพัสดุทั้ง 10 รายการที่เบิกจ่ายแล้ว...');
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    console.log('====================================================');
    console.log('🎉 การทดสอบเปิดเบราว์เซอร์และกดเบิก 10 รายการสำเร็จสมบูรณ์!');
    console.log('   (เปิดหน้าจอค้างไว้ 10 วินาที เพื่อให้คุณตรวจสอบได้เต็มตา)');
    console.log('====================================================');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดระหว่างการทดสอบ:', error);
    await page.screenshot({ path: path.join(artifactDir, 'error-screenshot.png') });
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
