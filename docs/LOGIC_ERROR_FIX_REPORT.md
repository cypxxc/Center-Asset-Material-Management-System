# CAMMS Business Logic Bug Fix Report (รายงานการแก้ไข Logic Errors)

**วันที่ดำเนินการ:** 20 พฤศจิกายน 2569  
**สถานะภาพรวม:** ทุกรายการได้รับการแก้ไขตรงจุด (Root Cause Resolved) และผ่าน Regression Tests ครบ 100%

---

## 1. ผลการแก้ไขรายรายการ (Detailed Bug Fixes)

### BUG-01: Cancel Draft Refunded Already Issued Stock & Lost Asset Tracking
- **Root Cause:** ฟังก์ชัน `cancelPostgresDisbursementDraft` อนุญาตให้ผู้สร้างหรือผู้ดูแลระบบกดยกเลิกเอกสารในสถานะ `draft` หรือ `pending_approval` ได้ทั้งฉบับโดยไม่ได้ตรวจสอบว่ามีรายการย่อย (line items) บางส่วนได้รับการอนุมัติจ่ายไปแล้ว (`status = 'issued'` หรือ `issued_qty > 0`) หรือไม่ เมื่อเอกสารเปลี่ยนสถานะเป็น `cancelled` ทริกเกอร์ `restore_pending_material_stock` ในฐานข้อมูลจะทำงานย้อนคืน Stock ให้แก่ทุกรายการที่มี `net < 0` ในเอกสาร ส่งผลให้ของที่ถูกเบิกจ่ายไปแล้วถูกคืนกลับเข้าคลังซ้ำ และทำให้ครุภัณฑ์ที่ส่งมอบไปแล้วสูญเสียการติดตาม
- **Files Changed:**
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - เพิ่มการตรวจสอบในระดับ Transaction ภายใต้ Lock ว่ามีรายการใดในเอกสารที่มี `status = 'issued' OR issued_qty > 0` หรือไม่ หากพบจะปฏิเสธการยกเลิกทั้งฉบับทันที (`throw new Error('ไม่สามารถยกเลิกเอกสารนี้ได้เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว...')`)
  - สำหรับเอกสารที่ยังไม่มีการจ่ายของ เมื่อกดยกเลิกจะทำการปรับสถานะของรายการย่อยที่ค้างอยู่ (`status = 'pending'`) ให้เป็น `'reversed'` อย่างชัดเจน
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-01`)
- **Test Result:** PASSED
- **Remaining Risk:** None (ป้องกันทั้งระดับ Application Logic และสอดคล้องกับ DB Trigger Invariant)
- **Status:** **FIXED**

---

### BUG-02: Confirm Disbursement Processed Rejected Lines & Duplicated Stock/Sequence
- **Root Cause:** ฟังก์ชัน `confirmPostgresDisbursement` ดึงรายการทั้งหมดในเอกสารมาวนลูปตัด Stock และโอนย้ายสถานะโดยไม่ได้กรอง `line.status` ทำให้รายการที่ถูกปฏิเสธไปแล้วในการอนุมัติบางส่วน (`status = 'reversed'`) ถูกนำกลับมาตัด Stock ซ้ำหรือบันทึกโอนกรรมสิทธิ์ นอกจากนี้ยังทำการ `allocateNextDisbursementNumber` สร้างเลขที่เอกสารใหม่เสมอ แม้เอกสารนั้นจะเคยได้รับจัดสรร `document_no` และ `fiscal_year` ไปแล้วตั้งแต่ตอนอนุมัติบางส่วน
- **Files Changed:**
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - กรองรายการที่จะประมวลผลให้เหลือเฉพาะ `line.status === 'pending'` เท่านั้น ข้ามรายการที่อยู่ในสถานะ `'reversed'` หรือ `'issued'` โดยเด็ดขาด
  - ตรวจสอบ `doc.document_no` และ `doc.fiscal_year` เดิม หากมีอยู่แล้วจากการอนุมัติบางส่วน จะนำเลขเดิมมาใช้ต่อโดยไม่เรียก Sequence ซ้ำ
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-02`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-03: Partial Return of Borrowed Assets Lacked Lost Asset Handling
- **Root Cause:** ในฟังก์ชัน `partialReturnPostgresDisbursement` และ Zod Schema `partialReturnDisbursementSchema` กำหนดให้สภาพของที่คืนรับได้เฉพาะ `'normal'` และ `'damaged'` โดยไม่รองรับสภาพ `'lost'` ส่งผลให้เมื่อครุภัณฑ์สูญหายระหว่างการยืม ผู้ดูแลระบบไม่สามารถบันทึกรับคืนเป็นของสูญหายผ่านหน้า partial return ได้ หรือหากฝืนคืนจะทำให้ครุภัณฑ์สูญหายถูกคืนกลับเป็นของพร้อมใช้งานใน Central Pool
- **Files Changed:**
  - `features/disbursements/schema.ts`
  - `features/disbursements/actions.ts`
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - ขยาย Enum ของ Condition ใน Zod Schema ให้รองรับ `'normal'`, `'damaged'`, และ `'lost'`
  - ในฟังก์ชัน `partialReturnPostgresDisbursement` เพิ่ม Logic สำหรับกรณี `condition === 'lost'` โดยกำหนดให้อัปเดตครุภัณฑ์เป็น `status = 'inactive'`, `is_central = false`, `quantity = 0`, `responsible_person = NULL`, บันทึก Note สูญหายจากการยืม และบันทึก `asset_custody_logs`
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-03`), `tests/unit/disbursement-pool-lifecycle.test.ts`
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-04: Single Item Return Cleared Custodian on Partial Return & Zeroed Total Stock on Lost
- **Root Cause:** ในฟังก์ชัน `returnPostgresDisbursementItem`:
  1. เมื่อมีการคืนบางส่วน (`newReturned < line.issued_qty`) ระบบกลับปลดชื่อผู้ยืมออก (`responsible_person = newResponsiblePerson` ซึ่งเป็น NULL หรือเจ้าของเดิม) ทันที ทั้งที่ยังมีของค้างอยู่กับผู้ยืม
  2. เมื่อสภาพเป็น `'lost'` ระบบคำนวณ `remainingQty` แต่ในคำสั่ง SQL อัปเดตตาราง `items` กลับไม่มีเงื่อนไขและอาจทำให้ข้อมูลจำนวนหรือสถานะไม่ถูกต้อง
- **Files Changed:**
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - กำหนดให้คงชื่อผู้ยืมไว้ใน `responsible_person` หากยังคืนไม่ครบ (`newReturned < line.issued_qty ? lineItem.responsible_person : newResponsiblePerson`)
  - สำหรับกรณี `'lost'` ปรับปรุงการคำนวณ `remainingQty = Math.max(0, item.quantity - data.return_qty)` และอัปเดต `quantity = remainingQty` พร้อมปรับ `status = remainingQty === 0 ? 'inactive' : (item.status ?? 'active')`
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-04`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-05: Reject Disbursement Allowed Partially Issued Docs & Left Lines in Pending State
- **Root Cause:** ฟังก์ชัน `rejectPostgresDisbursement` อนุญาตให้ปฏิเสธเอกสารทั้งฉบับได้แม้จะมีรายการบางส่วนถูกจ่ายไปแล้ว ส่งผลให้ยอดในเอกสารขัดแย้งกับประวัติการจ่ายจริง และเมื่อปฏิเสธแล้ว รายการย่อยใน `disbursement_items` ยังคงค้างสถานะ `'pending'` แทนที่จะเปลี่ยนเป็น `'reversed'`
- **Files Changed:**
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - เพิ่ม Guard Check นับรายการที่ `status = 'issued' OR issued_qty > 0` หากมีอยู่จะไม่อนุญาตให้ปฏิเสธทั้งฉบับ แต่แจ้งให้ผู้ใช้ไปใช้การปฏิเสธเฉพาะรายการที่เหลือ (`partialRejectDisbursement`) แทน
  - เมื่อปฏิเสธเอกสารสำเร็จ จะอัปเดตรายการย่อยที่ค้างอยู่ทั้งหมดให้มี `status = 'reversed'` ทันที
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-05`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-06: Print Voucher Showed Zero Quantity & Missing Snapshots for Pending Requisitions
- **Root Cause:** ใน `features/disbursements/print-generator.ts` บรรทัดที่ 47 ใช้เงื่อนไข `doc.status === 'draft' ? item.requested_qty : item.issued_qty` สำหรับเอกสารที่ส่งขออนุมัติแล้ว (`pending_approval`) ซึ่งยังไม่อนุมัติจ่าย `issued_qty` จะมีค่าเป็น 0 ทำให้ใบเบิกที่พิมพ์ออกมาแสดงจำนวนเป็น 0 และยอดเงินรวมเป็น 0.00 บาท อีกทั้งใน `getPostgresDisbursementById` ข้อมูล snapshot ต่างๆ จะเป็น null หากยังไม่ได้อนุมัติ
- **Files Changed:**
  - `features/disbursements/print-generator.ts`
  - `features/disbursements/postgres-queries.ts`
- **Fix Description:**
  - แก้ไขเงื่อนไขใน `print-generator.ts` เป็น `['draft', 'pending_approval'].includes(doc.status) ? item.requested_qty : item.issued_qty`
  - ใน `getPostgresDisbursementById` ดึงข้อมูลหมวดหมู่ หน่วยนับ และราคาต่อหน่วยจาก Master Data ปัจจุบันมาแสดงแทน (coalesce) เมื่อเอกสารยังอยู่ในสถานะร่างหรือรออนุมัติ
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-06`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-07: Disbursement Data Visibility Missing Ownership Enforcement for Non-Admins
- **Root Cause:** ฟังก์ชัน `getPostgresDisbursements` และ `getPostgresDisbursementById` ดึงข้อมูลเอกสารทั้งหมดโดยไม่มีเงื่อนไขกรองตามผู้สร้าง (`created_by`) ในกรณีที่ผู้ใช้งานไม่ใช่ Admin ทำให้ผู้ใช้ทั่วไปสามารถเรียกดูรายการเบิกจ่ายและใบเบิกของหน่วยงานอื่นหรือผู้ใช้อื่นได้ทั้งหมด
- **Files Changed:**
  - `features/disbursements/postgres-queries.ts`
  - `lib/postgres/session.ts`
- **Fix Description:**
  - ใน `getPostgresDisbursements` เพิ่มการตรวจสอบสิทธิ์: หากผู้ใช้งานไม่ใช่ `admin` จะบังคับใส่เงื่อนไข SQL `WHERE d.created_by = ${profile.id}` ทั้งในการดึงรายการและสถิติจำนวนเอกสาร
  - ใน `getPostgresDisbursementById` หากผู้ใช้ไม่ใช่ `admin` และไม่ใช่ผู้สร้างเอกสาร จะคืนค่า `null` ทันที
  - ใน `lib/postgres/session.ts` ป้องกันข้อผิดพลาดเมื่อเรียก `cookies()` นอก Request Scope เพื่อให้ Unit Tests สามารถทำงานได้อย่างปลอดภัย
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-07`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-08: Direct Custody Return Bypassed Active Borrow Workflow
- **Root Cause:** ฟังก์ชัน `returnPostgresCustody` อนุญาตให้คืนครุภัณฑ์เข้าคลังได้โดยตรงแม้ครุภัณฑ์นั้นจะกำลังอยู่ระหว่างการยืมตามเอกสารเบิกจ่าย (`active_borrow` หรือ `partially_returned`) ทำให้สถานะการถือครองในครุภัณฑ์ถูกตัดออกแต่เอกสารการยืมยังค้างอยู่ เกิดความไม่สอดคล้องของข้อมูล
- **Files Changed:**
  - `features/disbursements/custody-postgres.ts`
- **Fix Description:**
  - เพิ่มการตรวจสอบในฐานข้อมูลว่าครุภัณฑ์ดังกล่าวมีรายการยืมที่ยังค้างอยู่ในเอกสารสถานะ `active_borrow` หรือ `partially_returned` หรือไม่ หากพบจะปฏิเสธการคืนตรงและแจ้งให้ผู้ใช้ไปบันทึกรับคืนผ่านระบบเอกสารการยืมแทน
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-08`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-09: Asset Handover Reversal Forced is_central=true Overwriting Prior Ownership
- **Root Cause:** ฟังก์ชัน `reversePostgresDisbursement` สำหรับรายการส่งมอบครุภัณฑ์ (`asset_handover`) กำหนดให้ `is_central = true` เสมอเมื่อย้อนรายการ ทั้งที่ครุภัณฑ์บางรายการก่อนส่งมอบเคยมีผู้ถือครองประจำตัวอยู่ก่อนแล้ว ไม่ใช่ของส่วนกลาง
- **Files Changed:**
  - `features/disbursements/postgres-actions.ts`
- **Fix Description:**
  - ตรวจสอบประวัติการถือครองก่อนหน้า (`from_responsible` จาก `asset_custody_logs`) หากมีผู้ถือครองเดิมอยู่ จะคืนชื่อผู้ถือครองเดิมและกำหนด `is_central = false` จะกำหนดเป็น `true` เฉพาะในกรณีที่เดิมไม่มีผู้ถือครองส่วนบุคคลเท่านั้น
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-09`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-10: Batch Summary Misclassified Completed Requests as In-Progress
- **Root Cause:** ฟังก์ชัน `batchSummary` ใน `request-batch.ts` มีรายการ terminal states ไม่ครบ โดยขาดสถานะ `'confirmed'` ส่งผลให้กลุ่มเอกสารที่มีทั้งเอกสารที่จ่ายสำเร็จแล้ว (`confirmed`) และเอกสารที่คืนแล้ว (`returned`) ถูกแสดงสถานะเป็น `'ดำเนินการบางส่วน'` แทนที่จะเป็น `'สิ้นสุดแล้ว'`
- **Files Changed:**
  - `features/disbursements/request-batch.ts`
- **Fix Description:**
  - เพิ่ม `'confirmed'` ลงใน Array ของสถานะที่สิ้นสุดแล้ว (`['confirmed', 'returned', 'reversed', 'cancelled', 'rejected']`)
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-10`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-11: Bulk Edit Allowed Status Inactivation of In-Use Items & Mutated Material Custodians
- **Root Cause:** ฟังก์ชัน `mutatePostgresItems` อนุญาตให้ Admin ปรับปรุงสถานะแบบกลุ่มเป็น `inactive`, `damaged`, หรือ `disposed` ได้แม้รายการสิ่งของนั้นจะค้างอยู่ในคำขอเบิกที่รออนุมัติหรืออยู่ระหว่างการยืม และยังนำฟิลด์ `responsible_person` ไปอัปเดตลงตารางวัสดุสิ้นเปลือง (`materials`)
- **Files Changed:**
  - `features/items/postgres-actions.ts`
- **Fix Description:**
  - เพิ่ม Pre-check ปฏิเสธการเปลี่ยนสถานะสิ่งของเป็นไม่พร้อมใช้งาน หากมีรายการค้างอยู่ในคำขอรออนุมัติหรือการยืมที่ยังไม่คืน
  - จำกัดการแก้ไข `responsible_person` เฉพาะสิ่งของประเภทครุภัณฑ์ (`type === 'asset'`)
  - อัปเดต `databaseMessage` ให้ส่งผ่านข้อความเตือนทางธุรกิจเป็นภาษาไทยอย่างชัดเจน
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-11`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

### BUG-12: Admin Table Direct Delete Bypassed Soft Delete & Audit Trail for Inventory
- **Root Cause:** ฟังก์ชัน `pgDeleteTableRow` ในหน้าจัดการระบบของผู้ดูแลระบบ เรียกคำสั่ง SQL `DELETE FROM public.items` และ `public.materials` โดยตรง ทำให้เกิดการ Hard Delete ข้ามกลไก Soft Delete (`deleted_at`), ข้ามการตรวจสอบความสัมพันธ์เอกสาร และไม่มีการลบไฟล์ภาพที่เกี่ยวข้อง
- **Files Changed:**
  - `features/admin/postgres-admin.ts`
- **Fix Description:**
  - ดักจับกรณี `table === 'items'` หรือ `table === 'materials'` ให้เปลี่ยนไปเรียกใช้ฟังก์ชัน `archivePostgresItems` ซึ่งทำหน้าที่ Soft Delete, ตรวจสอบภาระผูกพัน และบันทึกประวัติ `DELETE_ITEM` ลงใน `audit_logs`
- **Regression Test:** `tests/unit/business-logic-bug-regression.test.ts` (Case: `BUG-12`)
- **Test Result:** PASSED
- **Remaining Risk:** None
- **Status:** **FIXED**

---

## 2. สรุปผลการตรวจสอบและการทดสอบ (Verification Summary)

| รายการทดสอบ | ผลลัพธ์ | หมายเหตุ |
| :--- | :---: | :--- |
| **Targeted Regression Tests (12/12 Bugs)** | **PASSED (12/12)** | `tests/unit/business-logic-bug-regression.test.ts` ผ่านครบทุกเคส |
| **Disbursement Lifecycle Tests** | **PASSED (7/7)** | `tests/unit/disbursement-pool-lifecycle.test.ts` |
| **Disbursement Request Navigation** | **PASSED (1/1)** | `tests/unit/disbursement-request-focus.test.ts` |
| **Custody & Return Tests** | **PASSED (6/6)** | `tests/unit/custody-return.test.ts`, `request-batch.test.ts`, etc. |
| **TypeScript Typecheck (`npm run typecheck`)** | **PASSED (0 Errors)** | ไม่มีข้อผิดพลาดของ Type |
| **Lint Verification (`npm run lint`)** | **PASSED (0 Errors)** | ไม่มี ESLint errors หลงเหลือ |

---

## 3. สรุปภาพรวมและสถานะความพร้อม (Executive Summary)

- **จำนวน Bugs ที่แก้สำเร็จ:** 12 รายการ (100%)
- **จำนวน Bugs ที่ยังค้าง:** 0 รายการ
- **จำนวน Tests Passed / Failed:** 26 / 0 ผ่านทั้งหมด
- **Database Migration Required:** **NO** (การแก้ไขทั้งหมดเป็นการปรับปรุง Logic และ Data Guard ในชั้น Application Server Actions และ Schemas โดยใช้โครงสร้างฐานข้อมูลที่มีอยู่อย่างถูกต้อง ปลอดภัย ไม่กระทบข้อมูลเดิม)
- **Production Logic Readiness:** **GO** ✅
