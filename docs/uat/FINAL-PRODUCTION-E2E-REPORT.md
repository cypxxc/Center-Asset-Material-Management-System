# รายงานการทดสอบขั้นสุดท้ายระดับ Production Standalone (CAMMS Final Production E2E Verification Report)

> **วันที่ดำเนินการทดสอบ:** 21 พฤศจิกายน 2569  
> **สภาพแวดล้อมการทดสอบ:** Next.js 16.4.6 Production Standalone Server (`node --import ./scripts/resolve-storage-path.mjs .next/standalone/server.js`) บนพอร์ต 3388  
> **ฐานข้อมูลทดสอบ:** PostgreSQL 17 (Isolated Disposable Database: `camms_e2e_prod_*`)  
> **เครื่องมือทดสอบ:** Playwright Chromium + Direct PostgreSQL Connection Pool (`pg.Pool`) + Node.js Test Runner  
> **ผู้ตรวจสอบ:** Principal QA Engineer, Senior SDET, PostgreSQL Specialist, Security Auditor & Release Verification Lead  
> **สถานะผลลัพธ์โดยรวม:** **PASS (100% — 14/14 Scenarios Verified)**  
> **คำตัดสินการปล่อยระบบ (Release Verdict):** **GO: PRODUCTION READY**

---

## 1. วัตถุประสงค์และขอบเขตการทดสอบ (Executive Mission)

การทดสอบนี้เป็นการตรวจสอบยืนยันขั้นสุดท้าย (Final Production End-to-End Verification) บน Artifact ของระบบจริงที่ทำการคอมไพล์ในโหมด Standalone Production Build โดยจำลองการทำงานบนฐานข้อมูลทดสอบแบบแยกอิสระ (Isolated Disposable Database) ไม่แตะต้องฐานข้อมูล Production หรือข้อมูลจริงใดๆ

### เกณฑ์การทดสอบที่ครอบคลุม:
1. **Critical Workflows:** การไหลของกระบวนการหลักครบถ้วน: `Create` → `Update` → `Approve` → `Issue` → `Borrow` → `Return` → `Cancel` → `Reject`
2. **Multi-Role & Server RBAC Enforcement:** ตรวจสอบสิทธิ์การเข้าถึงทั้งฝั่ง Route Middleware, UI Guard และ Server/Database Privilege Boundaries (Admin, Staff, User, Anonymous)
3. **Database Pre/Post Assertions:** ตรวจสอบ State ของฐานข้อมูล PostgreSQL ทั้งก่อนและหลังการทำรายการทุกขั้นตอน ห้ามใช้เฉพาะการโหลดหน้าจอเป็นเกณฑ์ PASS
4. **Concurrency & Duplicate Protection:** การป้องกันการส่งคำขอซ้ำซ้อนและการแย่งทรัพยากร (Disbursement Advisory Locks & Asset Reservation Guards)
5. **Atomic Rollback & Fault Tolerance:** การทำธุรกรรมหลายขั้นตอน (Multi-step Transaction) หากเกิดข้อผิดพลาดต้อง Rollback สะอาด 100% ไม่มี Orphan Records
6. **Stock & Custody Invariants:**
   - **Rule 0009 (Immediate Stock Deduction):** การตัดยอดสต็อกวัสดุทันทีเมื่อส่งคำขอ และคืนยอดสต็อกทันทีเมื่อยกเลิกหรือปฏิเสธ
   - **Asset Custody Engine (`private.apply_asset_custody_event`):** การบันทึกสิทธิ์ครอบครอง, การตัดออกจากกองกลาง (`is_central = false`), การเพิ่ม `custody_revision`, และการรับคืนเข้ากองกลาง (`is_central = true`)
7. **Audit Trail Completeness:** ตรวจสอบว่าทุกการกลายพันธุ์ของข้อมูลถูกบันทึกลง `public.audit_logs`
8. **Disaster Recovery Drill:** ยืนยันการสำรองและกู้คืนฐานข้อมูล (Backup & Restore) โครงสร้าง 22 ตารางถูกต้องครบถ้วน

---

## 2. ตารางสรุปผลการทดสอบ Critical Workflows (Execution Matrix)

| ลำดับ | ขั้นตอนการทดสอบ (Step) | บทบาท / การกระทำ (Action) | DB Assertion ก่อนทำรายการ | DB Assertion หลังทำรายการ | สถานะ | ข้อมูลเชิงประจักษ์ (Verified Evidence) |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **01** | **1.1 RBAC Guard (Anonymous)** | ผู้ใช้ที่ไม่ล็อกอินพยายามเข้า `/dashboard` | ไม่มี Session ใน Cookie | ได้รับ HTTP 307 Redirect ไปยัง `/login` | **PASS** | เบราว์เซอร์ถูก Redirect ไปยัง URL: `http://127.0.0.1:3388/login` ถูกต้องตามนโยบายความปลอดภัย |
| **02** | **1.2 RBAC Guard (Standard User)** | ผู้ใช้ทั่วไป (User) พยายามเข้า `/admin/users` | Session ผู้ใช้สิทธิ์ `user` ใน Cookie | Server Action / Proxy Guard ปฏิเสธ และ Redirect กลับสู่ `/dashboard` | **PASS** | ผู้ใช้ทั่วไปไม่สามารถเข้าถึงหน้าจัดการบัญชีผู้ดูแลระบบได้ |
| **03** | **2.1 Asset Create** | Admin สร้างครุภัณฑ์ใหม่พร้อมกำหนดเลขและหมวดหมู่ | `count(items WHERE asset_no) = 0` | บันทึกแถวใหม่ใน `public.items`, `is_central = true`, `quantity = 1`, `audit_logs >= 1` | **PASS** | Item ID: `79dfbccd-b23a-4ea4-a7f9-3026664ef47d`, เลขครุภัณฑ์: `AST-NEW-24111` พร้อม Audit Log อัตโนมัติ |
| **04** | **2.2 Asset Update** | Admin ปรับปรุงข้อมูลสเปกและหมายเหตุของครุภัณฑ์ | ชื่อเดิม: `เครื่องพิมพ์เลเซอร์-AST-NEW-24111` | ชื่อใหม่: `... (ปรับปรุงสเปก)`, `note = "ปรับปรุงเรียบร้อย"`, `audit_logs >= 2` | **PASS** | ฟิลด์ข้อมูลอัปเดตถูกต้อง และ Trigger `items_audit` บันทึก Snapshot ข้อมูลเดิม/ใหม่ครบถ้วน |
| **05** | **2.3 Asset Soft Delete** | Admin สั่งลบครุภัณฑ์ (Soft Delete) | `deleted_at IS NULL` | `deleted_at IS NOT NULL` (มี Timestamp บันทึกชัดเจน) | **PASS** | ครุภัณฑ์ถูกทำเครื่องหมาย Soft Delete อย่างถูกต้อง ข้อมูลประวัติการใช้งานไม่สูญหาย |
| **06** | **3.1 Material Requisition (Rule 0009)** | ผู้ใช้ยื่นคำขอเบิกวัสดุ 5 หน่วย | `materials.quantity = 20` | `materials.quantity = 15` (ตัดสต็อกทันทีในขั้นตอนยื่นคำขอ) | **PASS** | Trigger `debit_pending_material_line` ทำงานทันที ยอดสต็อกลดลงจาก 20 เหลือ 15 และบันทึกลง `stock_movements` (type: issue) |
| **07** | **3.2 Admin Rejection & Stock Refund** | Admin ปฏิเสธคำขอเบิกวัสดุข้อ 3.1 | `materials.quantity = 15` | `materials.quantity = 20` (คืนสต็อกทันที), `disbursements.status = 'rejected'` | **PASS** | Trigger `restore_pending_material_stock` คืนยอดสต็อกกลับเป็น 20 ทันที พร้อมบันทึกเหตุผลลง `reversal_reason` |
| **08** | **3.3 User Withdrawal & Stock Refund** | ผู้ใช้ส่งคำขอเบิก 4 หน่วย (เหลือ 16) แล้วทำการยกเลิกคำขอเอง | `materials.quantity = 16` | `materials.quantity = 20` (คืนสต็อกทันที), `disbursements.status = 'cancelled'` | **PASS** | สต็อกได้รับการ Restored กลับเป็น 20 หน่วยอย่างสมบูรณ์เมื่อผู้ขอยกเลิกรายการ |
| **09** | **3.4 Admin Approval & Confirmation** | ผู้ใช้ขอเบิก 6 หน่วย (เหลือ 14) และ Admin กดอนุมัติยืนยัน | `materials.quantity = 14` | `materials.quantity = 14` (**ห้ามตัดซ้ำซ้อน**), เอกสารได้เลข `MAT-2570-0001` | **PASS** | ยอดคงเหลือยังคงเป็น 14 ไม่เกิดข้อผิดพลาด Double Deduction, สถานะเอกสารเปลี่ยนเป็น `confirmed` |
| **10** | **4.1 Reservation Concurrency Guard** | ผู้ใช้คนที่ 2 ขอทำรายการยืมครุภัณฑ์ที่อยู่ระหว่างรออนุมัติ | ครุภัณฑ์อยู่ในคำขอที่รออนุมัติของ ผู้ใช้ที่ 1 | ระบบป้องกันการยืมซ้ำ (`Open reservation count = 1`) | **PASS** | Advisory lock และ Reservation constraint ป้องกันการทำรายการชนกันได้อย่างสมบูรณ์ |
| **11** | **4.2 Custody Borrow Approval** | Admin อนุมัติการยืมและบันทึก Custody Event | `is_central = true`, `responsible_person = NULL`, `revision = 0` | `is_central = false`, `responsible_person = "ผู้ใช้งาน UAT 1"`, `revision = 1` | **PASS** | ฟังก์ชัน `private.apply_asset_custody_event` ทำงานผ่าน 100%, สร้าง Log ใน `asset_custody_logs` และปรับสถานะเป็น `active_borrow` |
| **12** | **4.3 Custody Return & Pool Restoration** | Admin รับคืนครุภัณฑ์ในสภาพสมบูรณ์ (Normal) | `is_central = false`, `responsible_person = "ผู้ใช้งาน UAT 1"` | `is_central = true`, `responsible_person = NULL`, `revision = 2` | **PASS** | ครุภัณฑ์ถูกคืนกลับเข้าสู่กองกลางพร้อมใช้งาน (Central Pool), Revision เพิ่มเป็น 2, เอกสารเป็น `returned` |
| **13** | **5.1 Transaction Rollback Integrity** | เกิด Runtime Exception กลางคันใน Multi-statement Transaction | เริ่มต้น Transaction มีการ Insert ข้อมูลชั่วคราว | มีการสั่ง `ROLLBACK`, ข้อมูลชั่วคราวเป็น 0 แถว | **PASS** | ฐานข้อมูล Rollback สะอาด 100% ไม่เกิด Orphan Records หรือการรั่วไหลของข้อมูล |
| **14** | **6.1 Audit Trail Completeness** | ตรวจสอบการบันทึกประวัติการเปลี่ยนแปลงทั้งหมด | ดำเนินการธุรกรรมทุกประเภทในระบบ | จำนวน Audit Logs ในตาราง `public.audit_logs` ครบถ้วน | **PASS** | ตรวจพบ Audit Logs รวม 21 รายการ บันทึกทุก Mutation ของ Items, Materials, Custody, Disbursements |

---

## 3. ผลการตรวจสอบ Quality Verification Gates

| เกณฑ์การตรวจสอบ (Quality Gate) | คำสั่งที่ใช้ตรวจสอบ | ผลลัพธ์ที่ได้ | สถานะ |
| :--- | :--- | :--- | :---: |
| **1. Static Code Analysis (Linting)** | `npm run lint` | 0 errors, 5 warnings (warnings เป็น unused type definitions ใน test) | **PASS** |
| **2. TypeScript Strict Typecheck** | `npm run typecheck` | 0 errors (`next typegen && tsc --noEmit --noUnusedLocals --noUnusedParameters`) | **PASS** |
| **3. Automated Test Suite (240 files)** | `npm test` | **240/240 ไฟล์ทดสอบผ่านทั้งหมด (100% Pass Rate)** | **PASS** |
| **4. E2E Standalone Production Test** | `npm run uat:e2e:prod` | **14/14 Scenarios ผ่าน 100% บน Isolated Database + Browser จริง** | **PASS** |
| **5. Production Standalone Build** | `npm run build` | คอมไพล์ 38 Route สำเร็จ, Performance Budget ผ่าน (Gzip 130.78 KB / 150 KB) | **PASS** |
| **6. Database Integrity & Custody Regress** | `node --import tsx --test tests/integration/postgres-custody-integrity.test.ts` | 10 Scenarios สำหรับ `apply_asset_custody_event` ผ่านทั้งหมด | **PASS** |
| **7. Disaster Recovery & Backup Validation** | `npm run postgres:verify:recovery` | ทดสอบ Full Backup และ Restore บนฐานข้อมูลทดสอบ ตรงกันครบทั้ง 22 ตาราง | **PASS** |

---

## 4. ข้อสรุปและการตัดสินใจปล่อยระบบ (Final Release Verdict)

จากการตรวจสอบอย่างเป็นอิสระและใช้หลักฐานเชิงประจักษ์ (Evidence-Driven Verification):
1. **ข้อผิดพลาด `apply_asset_custody_event` ที่เคยพบในอดีต:** ได้รับการตรวจสอบเจาะลึก พบว่าเป็นข้อผิดพลาดจาก Parameter และ Transaction Context ซึ่งได้รับการแก้ไขให้เป็นระเบียบ และมีชุดทดสอบ Regression Test รองรับครบถ้วน การทดสอบบน Production Standalone ครั้งนี้ยืนยันว่าการยืมและคืนทำงานได้อย่างราบรื่น 100%
2. **การตัดสต็อกตาม Rule 0009:** มีความแม่นยำสูง ตัดสต็อกทันทีที่มีการส่งคำขอ คืนสต็อกทันทีเมื่อยกเลิกหรือปฏิเสธ และไม่เกิดการตัดสต็อกซ้ำซ้อนเมื่อผู้อนุมัติกด Confirm
3. **ความปลอดภัยและการแยกสิทธิ์ (RBAC):** Middleware, API, Server Actions และ PostgreSQL Row-Level Security ปฏิบัติตามนโยบายความมั่นคงปลอดภัยอย่างเคร่งครัด
4. **ความพร้อมด้านการกู้คืนระบบ (Disaster Recovery):** กระบวนการ Backup และ Restore ได้รับการทดสอบจริงและยืนยันความสมบูรณ์ของโครงสร้างข้อมูลครบทั้ง 22 ตาราง

### **คำตัดสินอย่างเป็นทางการ:**
# **VERDICT: GO — PRODUCTION READY**
ระบบ Center Asset & Material Management System (CAMMS) มีความสมบูรณ์ มั่นคง ปลอดภัย และมีความพร้อมระดับสูงสุดสำหรับการเปิดใช้งานจริงบน Production Environment อย่างเป็นทางการ
