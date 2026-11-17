# รายงานการวิเคราะห์และตรวจสอบจุดผิดพลาดทาง Business Logic และ System Defects
**ระบบ:** CAMMS (Center Asset Material Management System)  
**วันที่ตรวจสอบ:** 15 พฤศจิกายน 2569  
**สถานะการ Build:** ผ่าน (`next build --webpack` สำเร็จ)  
**ชุดการทดสอบ:** 204 ไฟล์ทดสอบ (ตรวจพบจุดบกพร่อง/Logic Inconsistency ใน 20 ไฟล์)

---

## สรุปภาพรวม (Executive Summary)

จากการตรวจสอบ Source Code, การทำงานของ Database Transactions (PostgreSQL), Business Rules ของการเบิกจ่ายและครุภัณฑ์ส่วนกลาง รวมถึงการทดสอบผ่าน Test Runner พบจุดผิดพลาดที่สำคัญทั้งในระดับ **Business Logic (กฎเกณฑ์ทางธุรกิจ)**, **Validation Logic (การตรวจสอบเงื่อนไข)** และ **System Inconsistency (ความเข้ากันได้ของการทำงาน)** ซึ่งแบ่งออกเป็น 4 หมวดหลัก ดังนี้:

---

## 1. จุดผิดพลาดทาง Business Logic ระดับวิกฤต (Critical Business Logic Flaws)

### 1.1 เงื่อนไขการรับคืนพัสดุถูกบล็อกก่อนถึงกำหนดเวลา (Disbursement Return Due Date Inconsistency)
- **ตำแหน่งไฟล์:** `features/disbursements/postgres-actions.ts` (บรรทัด 395-398) และ `features/disbursements/components/transaction-items-table.tsx`
- **ปัญหาทางตรรกะ:**
  ในฟังก์ชัน `returnPostgresDisbursementItem()` มีการใส่เงื่อนไข:
  ```ts
  const dueCheck = await tx.execute<{ is_due: boolean }>(
    sql`SELECT ${doc.due_date}::date <= (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS is_due`
  )
  if (dueCheck.rows[0]?.is_due !== true) throw new Error('ยังไม่ถึงกำหนดคืนพัสดุ')
  ```
- **ผลกระทบ:**
  - **ในทางปฏิบัติราชการ/การใช้งานจริง:** หากผู้ยืมนำครุภัณฑ์มาคืน **ก่อน** วันครบกำหนด (Early Return เช่น กำหนดคืนอีก 7 วัน แต่ใช้เสร็จแล้วนำมาคืนในวันที่ 2) ระบบจะ **ปฏิเสธและโยนข้อผิดพลาด "ยังไม่ถึงกำหนดคืนพัสดุ" ทันที** ทำให้เจ้าหน้าที่พัสดุไม่สามารถบันทึกรับคืนของเข้าคลังได้
  - ส่งผลให้ทรัพย์สินตกค้างอยู่ในสถานะ `active_borrow` โดยไม่จำเป็น และขัดแย้งกับ Test `tests/unit/disbursement-pool-lifecycle.test.ts`

---

### 1.2 การสูญหายของพัสดุกับการคืนสถานะของส่วนกลาง (Lost Assets vs Central Pool Restoration)
- **ตำแหน่งไฟล์:** `features/disbursements/postgres-actions.ts`
- **ปัญหาทางตรรกะ:**
  เมื่อมีการรับคืนครุภัณฑ์ที่มีสภาพชำรุดเสียหายหนัก หรือ "สูญหาย" (Lost) แต่ระบบกลับไม่มีเงื่อนไขแยกแยะว่าหากสภาพพัสดุระบุว่าสูญหาย จะต้องไม่คืนสถานะ `is_central = true` หรือนำกลับเข้าสู่ Pool ที่พร้อมให้ผู้อื่นยืมต่อทันที
- **ผลกระทบ:**
  พัสดุที่ผู้ยืมทำสูญหายหรือเสียหายจนใช้งานไม่ได้ อาจถูกนำกลับเข้าไปแสดงใน Central Catalog ให้ผู้ใช้อื่นกดขอยืมได้อีก

---

### 1.3 การจัดการและกรองสถานะคำขอที่ถูกปฏิเสธ (Rejected Disbursements Filter Leak)
- **ตำแหน่งไฟล์:** `features/disbursements/postgres-queries.ts`
- **ปัญหาทางตรรกะ:**
  ก่อนหน้านี้ Query มีการบังคับ `d.status <> 'rejected'` ตลอดเวลา ทำให้เมื่อแอดมินหรือผู้ใช้ต้องการค้นหาคำขอที่มีสถานะ `rejected` (ไม่อนุมัติ) โดยระบุ `status = 'rejected'` ระบบกลับไม่แสดงผลลัพธ์ใดๆ ออกมาเลย (แม้จะเริ่มมีการแก้เงื่อนไขใน commit ล่าสุด แต่ยังส่งผลกระทบต่อประวัติการอนุมัติและการตรวจสอบสิทธิ์)

---

### 1.4 การตรวจสอบสิทธิ์การเข้าถึงคิวงานแอดมิน (Admin Work Queue Authorization Bypass on Component Level)
- **ตำแหน่งไฟล์:** `components/dashboard/dashboard-admin-work-queue.tsx`
- **ปัญหาทางตรรกะ:**
  คอมโพเนนต์ `AdminDashboardWorkQueue` เรียกใช้ `getDisbursements({ status: 'pending_approval' })` โดยไม่มีการตรวจเช็ค `profile.role === 'admin'` ภายในฟังก์ชันของ Server Component ซ้ำก่อนรัน Logic (ไปพึ่งพาเพียงเงื่อนไขใน `page.tsx`) หากมีการเรียกใช้งานคอมโพเนนต์นี้จากจุดอื่น หรือถูกเข้าถึงโดยไม่ผ่านเพจหลัก ผู้ใช้ทั่วไปอาจเรียกดูจำนวนและรายการคำขอที่รออนุมัติได้

---

## 2. ปัญหาด้าน User Experience & Data Integrity

### 2.1 การแสดงผลและการเปลี่ยนหน้า (Server-Side Pagination & Ledger Off-by-one)
- **ตำแหน่งไฟล์:** `features/items/components/items-list-view.tsx`, `features/items/components/items-explorer-client.tsx`
- **ปัญหาทางตรรกะ:**
  - การนับจำนวนแถวใน Header ตารางเปรียบเทียบกับจำนวนข้อมูลที่แท้จริง เกิดความคลาดเคลื่อน (Off-by-one error ในการคำนวณ Rows vs Headers ในมุมมอง Ledger)
  - เมื่อมีการลบแถวสุดท้ายในหน้าปัจจุบัน ระบบไม่ได้อัปเดต Query Parameter ของหน้าให้ถอยกลับไปยังหน้าก่อนหน้า (Previous Page) โดยอัตโนมัติ ทำให้ผู้ใช้ค้างอยู่ในหน้าที่ไม่มีข้อมูล (Empty Page)

### 2.2 การกักข้อมูลไฟล์รูปภาพค้างเมื่อแบบฟอร์มตรวจสอบไม่ผ่าน (Form Image Upload Orphan Artifacts)
- **ตำแหน่งไฟล์:** `features/items/actions.ts`
- **ปัญหาทางตรรกะ:**
  ในกระบวนการบันทึกข้อมูลพัสดุ (`saveItem`) เมื่อผู้ใช้อัปโหลดรูปภาพใหม่ ระบบสร้างไฟล์บน Disk ก่อนการตรวจสอบ Schema เสร็จสมบูรณ์ หาก Schema ล้มเหลว (เช่น ชื่อว่างเปล่า หรือราคาติดลบ) ระบบพยายาม rollback แต่หากเซิร์ฟเวอร์ขัดข้องหรือเกิด unhandled exception ระหว่างทาง จะเกิด Orphan Image Files ค้างอยู่ในโฟลเดอร์จัดเก็บ

---

## 3. ปัญหาด้าน System Token & CSS Design Constraints

### 3.1 การลบ Dark Mode Tokens ออกจาก `globals.css`
- **ตำแหน่งไฟล์:** `app/globals.css`
- **ปัญหาทางตรรกะ:**
  ใน Commit `14df879` มีการนำบล็อก `.dark, [data-theme="dark"]` ออกจาก `app/globals.css`
- **ผลกระทบ:**
  - แม้ `next build` จะผ่าน (เพราะ CSS Syntax ถูกต้อง) แต่ทำให้ระบบ **ไม่รองรับ Dark Mode** ตามข้อกำหนดผลิตภัณฑ์ที่ระบุไว้ใน `docs/context/PRODUCT.md` ข้อ 29: *"Light and dark mode via semantic CSS tokens"*
  - ทำให้ Test `tests/unit/theme-tokens.test.ts` ล้มเหลว

---

## 4. ตารางสรุปรายการจุดผิดพลาดและการแก้ไขที่แนะนำ (Action Plan)

| ลำดับ | รายการข้อผิดพลาด | ระดับความรุนแรง | แนวทางแก้ไข (Recommendation) |
|---|---|---|---|
| 1 | บล็อกการคืนพัสดุก่อนวันครบกำหนด (`is_due`) | **สูง (Critical)** | ปรับเงื่อนไขใน `postgres-actions.ts` ให้แอดมินสามารถรับคืนพัสดุได้ทุกเมื่อหากสถานะเป็น `active_borrow` หรือ `partially_returned` โดยไม่ต้องรอให้ถึงวันที่ `due_date` |
| 2 | พัสดุสูญหายคืนเข้า Central Pool | **สูง (High)** | เพิ่มเงื่อนไขตรวจสอบ `condition === 'lost'` ไม่ให้รีเซ็ต flag `is_central = true` หรือให้คงสถานะสูญหายไว้ในระบบ |
| 3 | Dark Mode Tokens สูญหาย | **ปานกลาง (Medium)** | คืนค่า CSS variables สำหรับ selector `.dark, [data-theme="dark"]` ใน `app/globals.css` |
| 4 | Auth Check ซ้ำซ้อนใน Admin Dashboard Component | **ปานกลาง (Medium)** | ตรวจสอบ `profile.role === 'admin'` ใน `AdminDashboardWorkQueue` ก่อนดึงข้อมูลคำขอ |
| 5 | Pagination Empty Page เมื่อลบรายการสุดท้าย | **ปานกลาง (Medium)** | อัปเดต Router ให้ redirect ไปที่ `page - 1` เมื่อแถวสุดท้ายของหน้านั้นถูกลบออก |

---
*รายงานนี้จัดทำขึ้นจากการตรวจสอบเชิงลึกทั้งทางโค้ด การทดสอบยูนิต และ Business Constraint ของระบบ CAMMS*
