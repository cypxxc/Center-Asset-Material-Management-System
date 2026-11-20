# รายงานการตรวจสอบข้อผิดพลาดทางตรรกะระดับลึก (Deep Business Logic Audit Report)

**โครงการ:** Center Asset & Material Management System (CAMMS)  
**วันที่ตรวจสอบ:** 20 พฤศจิกายน 2026  
**วิธีการ:** White-box Deep Code Review, State Transition & Invariant Analysis, Concurrency & Security Tracing  
**ขอบเขต:** Source Code ทั้งหมดใน `features/`, `app/`, `lib/`, `db/` โดยไม่พึ่งพารายงานเก่า

---

## สรุปภาพรวมสำหรับผู้บริหาร (Executive Summary)

จากการตรวจสอบ Source Code ของระบบ CAMMS อย่างละเอียด เพื่อค้นหา **Logic Errors, Business Logic Bugs, Data Integrity Issues และ Edge Cases** ที่อาจเกิดขึ้นจริง แม้ Unit Tests และ Integration Tests จะผ่านทั้งหมด พบข้อบกพร่องทางตรรกะในระบบจริงจำนวน **12 รายการ** แบ่งตามระดับความรุนแรงดังนี้:

- **Critical (วิกฤติ):** 3 รายการ
- **High (สูง):** 4 รายการ
- **Medium (ปานกลาง):** 4 รายการ
- **Low (ต่ำ):** 1 รายการ

**สถานะความพร้อมในการขึ้นระบบจริง (Production Logic Readiness):**  
⛔ **CONDITIONAL GO (ต้องแก้ไข Top 5 ปัญหาก่อน Release สู่ Production)**  
เนื่องจากพบช่องโหว่ทางตรรกะที่ทำให้เกิด **"สต็อกผี (Ghost Stock)"** จากการคืนสต็อกซ้ำซ้อน และการ **"อนุมัติซ้ำ (Double Deduction)"** ของรายการที่เคยปฏิเสธไปแล้ว หากปล่อยขึ้นระบบจริงจะส่งผลให้ยอดคงเหลือทางบัญชีพัสดุคลาดเคลื่อนโดยไม่มี Error แจ้งเตือน

---

## สารบัญข้อบกพร่องที่ตรวจพบ (Findings Inventory)

| รหัส | ระดับความรุนแรง | หัวข้อปัญหา | ไฟล์ที่เกี่ยวข้อง | สถานะการยืนยัน |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **Critical** | การยกเลิกคำขอที่อนุมัติไปแล้วบางส่วน ทำให้เกิดการคืนสต็อกซ้ำซ้อน (Ghost Stock) และครุภัณฑ์สูญหายจากระบบ | `features/disbursements/postgres-actions.ts:219-250` | **Confirmed** |
| **BUG-02** | **Critical** | การยืนยันเอกสาร (`confirmPostgresDisbursement`) นำรายการที่ถูกปฏิเสธไปแล้วกลับมาตัดสต็อกและจ่ายซ้ำ | `features/disbursements/postgres-actions.ts:255-375` | **Confirmed** |
| **BUG-03** | **Critical** | ครุภัณฑ์สูญหายจากการยืมคืน ถูกปรับเป็นสถานะพร้อมใช้ (Active) และคืนเข้าส่วนกลางใน `partialReturnPostgresDisbursement` | `features/disbursements/postgres-actions.ts:1233-1243` | **Confirmed** |
| **BUG-04** | **High** | การรับคืนครุภัณฑ์บางส่วน ล้างชื่อผู้ถือครองทันที และกรณีสูญหายล้างยอดคงเหลือทั้งหมดเป็น 0 | `features/disbursements/postgres-actions.ts:471-498` | **Confirmed** |
| **BUG-05** | **High** | รายการย่อยค้างสถานะ 'pending' ตลอดกาลเมื่อเอกสารถูกปฏิเสธหรือยกเลิกทั้งฉบับ | `features/disbursements/postgres-actions.ts:850-855` | **Confirmed** |
| **BUG-06** | **High** | ใบเบิกพัสดุ (Print Voucher) แสดงจำนวนเป็น 0 และข้อมูลเป็นขีดว่างสำหรับคำขอที่รออนุมัติ | `features/disbursements/print-generator.ts:46-68` | **Confirmed** |
| **BUG-07** | **High** | ผู้ใช้งานทั่วไปสามารถมองเห็นเอกสารเบิกจ่ายของทุกคนในหน่วยงานได้ (Missing Data Boundary) | `features/disbursements/postgres-queries.ts:16-56` | **Confirmed** |
| **BUG-08** | **Medium** | การรับคืนครุภัณฑ์ผ่านโมดูล Custody ทำให้เอกสารยืมคงค้างสถานะ Active Borrow และแจ้งเตือน Overdue ตลอดไป | `features/disbursements/custody-postgres.ts:404-453` | **Confirmed** |
| **BUG-09** | **Medium** | การย้อนรายการส่งมอบครุภัณฑ์ระหว่างบุคคล กำหนดให้เป็นของส่วนกลางทั้งที่มีผู้ถือครองเดิม | `features/disbursements/postgres-actions.ts:670-672` | **Confirmed** |
| **BUG-10** | **Medium** | สรุปสถานะชุดคำขอ (Batch Summary) แสดง 'ดำเนินการบางส่วน' ตลอดไป สำหรับชุดคำขอผสมที่เสร็จสมบูรณ์แล้ว | `features/disbursements/request-batch.ts:16-22` | **Confirmed** |
| **BUG-11** | **Medium** | การแก้ไขสถานะสิ่งของแบบกลุ่ม (Bulk Edit) ข้ามการตรวจสอบคำขอเบิกหรือการยืมที่ค้างอยู่ | `features/items/postgres-actions.ts:142-154` | **Confirmed** |
| **BUG-12** | **Low** | การลบข้อมูลผ่านหน้า Admin Table Management เป็นการ Hard Delete และไม่มี Audit Trail | `features/admin/postgres-admin.ts:117-131` | **Confirmed** |

---

## รายละเอียดการตรวจสอบเชิงลึก (Detailed Audit Findings)

---

### [BUG-01] การยกเลิกคำขอที่อนุมัติไปแล้วบางส่วน ทำให้เกิดการคืนสต็อกซ้ำซ้อน (Ghost Stock) และครุภัณฑ์สูญหายจากระบบ

- **Severity:** Critical
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path และ Trigger Definition)
- **File Path & Line Number:** 
  - `features/disbursements/postgres-actions.ts:219-250` (`cancelPostgresDisbursementDraft`)
  - `db/postgres/migrations/0000_final_schema.sql:997-1030` (`restore_pending_material_stock`)
- **Function:** `cancelPostgresDisbursementDraft`
- **Root Cause:**  
  ฟังก์ชัน `cancelPostgresDisbursementDraft` อนุญาตให้ยกเลิกเอกสารได้หาก `doc.status === 'pending_approval'` โดยไม่ได้ตรวจสอบว่าในเอกสารนั้นมีรายการย่อยที่ได้รับการอนุมัติและจ่ายพัสดุออกไปแล้ว (`status = 'issued'` หรือ `issued_qty > 0`) จากการทำ `partialApprovePostgresDisbursement` หรือไม่  
  เมื่อเอกสารเปลี่ยนสถานะเป็น `'cancelled'` ทริกเกอร์ของฐานข้อมูล `restore_pending_material_stock` จะทำงานอัตโนมัติ โดยวนลูปคืนสต็อกวัสดุทุกรายการในเอกสารที่มี `net < 0` กลับเข้าคลัง
- **เงื่อนไขที่ทำให้เกิด Bug:**
  1. ผู้ใช้สร้างคำขอเบิกพัสดุ 2 รายการขึ้นไป (เช่น วัสดุ A จำนวน 5 ชิ้น, วัสดุ B จำนวน 5 ชิ้น) เอกสารอยู่ในสถานะ `pending_approval`
  2. ผู้ดูแลระบบทำการอนุมัติเฉพาะรายการ A ผ่าน `partialApprovePostgresDisbursement` ทำให้รายการ A ถูกจ่ายออกไปจริง (`issued_qty = 5`, `status = 'issued'`) สต็อกวัสดุ A ในคลังถูกตัดออกไป 5 ชิ้น แต่เนื่องจากรายการ B ยังรออนุมัติ หัวเอกสารจึงยังคงสถานะ `pending_approval`
  3. ผู้ใช้ (หรือแอดมิน) กด "ยกเลิกคำขอ" (Cancel Request)
  4. ฟังก์ชัน `cancelPostgresDisbursementDraft` อัปเดต `disbursements.status = 'cancelled'`
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ระบบต้องปฏิเสธการยกเลิกเอกสารทั้งฉบับหากมีรายการที่ถูกจ่ายพัสดุออกไปแล้ว หรืออนุญาตให้ยกเลิกได้เฉพาะรายการย่อยที่ยังรออนุมัติเท่านั้น และต้องไม่มีการคืนสต็อกของรายการที่จ่ายพัสดุให้ผู้ใช้ไปแล้ว
  - *Actual Behavior:* เอกสารเปลี่ยนเป็นสถานะ `cancelled` ทั้งฉบับ และทริกเกอร์ `restore_pending_material_stock` คืนสต็อกวัสดุ A กลับเข้าคลัง +5 ชิ้น ทั้งที่ผู้ใช้รับวัสดุไปแล้ว เกิดยอดสต็อกทางบัญชีงอกขึ้นมาในคลัง (Ghost Stock)  
  - *ในกรณีของครุภัณฑ์:* ครุภัณฑ์ถูกส่งมอบให้ผู้ใช้แล้ว (`items.responsible_person = user`) แต่หัวเอกสารกลายเป็น `cancelled` ส่งผลให้ไม่สามารถกดรับคืน (`returnPostgresDisbursementItem`) หรือย้อนรายการ (`reversePostgresDisbursement`) ได้อีกเลย เนื่องจากฟังก์ชันรับคืนต้องการสถานะ `'active_borrow'` หรือ `'confirmed'` ครุภัณฑ์จะหลุดจากการติดตามและกำกับดูแลตลอดไป
- **ผลกระทบ:** ยอดพัสดุในคลังไม่ตรงกับความเป็นจริง, พัสดุของรัฐสูญหายโดยไม่สามารถตรวจสอบหรือติดตามคืนได้
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-actions.ts:231-236
  if (user.role !== 'admin' && doc.status !== 'pending_approval') throw new Error('ยกเลิกได้เฉพาะคำขอของตนเองที่รออนุมัติ')
  if (!['draft', 'pending_approval'].includes(doc.status)) throw new Error('ไม่สามารถยกเลิกรายการที่อนุมัติหรือจบแล้วได้')

  await tx.execute(
    sql`UPDATE public.disbursements SET status = 'cancelled', updated_at = now() WHERE id = ${data.id}`
  )
  ```
  ```sql
  -- db/postgres/migrations/0000_final_schema.sql:1011-1024
  -- ทริกเกอร์จะคืนสต็อกทุกบรรทัดที่มี net < 0 โดยไม่สนใจว่ารายการนั้นมีสถานะ 'issued' หรือไม่
  FOR v_line IN
    SELECT di.id,di.item_id,coalesce(sum(sm.delta),0) AS net
    FROM public.disbursement_items di LEFT JOIN public.stock_movements sm
      ON sm.disbursement_item_id=di.id AND sm.movement_type IN ('issue','reversal')
    WHERE di.disbursement_id=NEW.id GROUP BY di.id,di.item_id ORDER BY di.item_id
  LOOP
    IF v_line.net<0 THEN
      UPDATE public.materials SET quantity=quantity-v_line.net ...
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `cancelPostgresDisbursementDraft` ให้เพิ่ม Guard Check ก่อนอัปเดต:
  ```typescript
  const issuedCheck = await tx.execute<{ count: number }>(
    sql`SELECT count(*)::int as count FROM public.disbursement_items 
        WHERE disbursement_id = ${data.id} AND (status = 'issued' OR issued_qty > 0)`
  )
  if (issuedCheck.rows[0].count > 0) {
    throw new Error('ไม่สามารถยกเลิกเอกสารนี้ได้เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว กรุณาปฏิเสธเฉพาะรายการที่เหลือแทน')
  }
  ```

---

### [BUG-02] การยืนยันเอกสาร (`confirmPostgresDisbursement`) นำรายการที่ถูกปฏิเสธไปแล้วกลับมาตัดสต็อกและจ่ายซ้ำ

- **Severity:** Critical
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/postgres-actions.ts:255-375`
- **Function:** `confirmPostgresDisbursement`
- **Root Cause:**  
  ฟังก์ชัน `confirmPostgresDisbursement` ดึงรายการสิ่งของทั้งหมดในเอกสาร (`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${disbursementId}`) มาวนลูปตัดสต็อกและจ่ายพัสดุ โดยไม่ได้กรองสถานะ `WHERE status = 'pending'`  
  หากก่อนหน้านี้แอดมินทำการปฏิเสธบางรายการผ่าน `partialRejectPostgresDisbursement` รายการนั้นจะถูกคืนสต็อกและเปลี่ยนสถานะเป็น `'reversed'` ยอดสุทธิใน `stock_movements` จึงกลับมาเป็น 0 เมื่อ `confirmPostgresDisbursement` ตรวจสอบ `materialNet` จะพบว่ายอดเป็น 0 จึงเข้าใจว่ารายการนี้ยังไม่เคยตัดสต็อก (`materialAlreadyDebited = false`) แล้วทำการตัดสต็อกซ้ำ อัปเดตสถานะกลับเป็น `'issued'` และจ่ายพัสดุที่เคยปฏิเสธไปแล้ว
- **เงื่อนไขที่ทำให้เกิด Bug:**
  1. เอกสารมี 2 รายการ รายการที่ 1 อนุมัติได้ รายการที่ 2 แอดมินกดปฏิเสธผ่าน `partialRejectPostgresDisbursement`
  2. รายการที่ 2 เปลี่ยนสถานะเป็น `reversed` สต็อกถูกคืนกลับเข้าคลัง
  3. หัวเอกสารยังคงสถานะ `pending_approval` เพราะรายการที่ 1 ยังไม่ได้อนุมัติ
  4. แอดมินกด "ยืนยันและอนุมัติเอกสาร" (`confirmPostgresDisbursement`)
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* การยืนยันเอกสารต้องดำเนินการเฉพาะรายการที่ยังรออนุมัติ (`status = 'pending'`) เท่านั้น รายการที่ถูกปฏิเสธไปแล้ว (`status = 'reversed'`) ต้องคงสถานะเดิมและไม่ถูกตัดสต็อกซ้ำ
  - *Actual Behavior:* รายการที่ถูกปฏิเสธไปแล้วถูกนำกลับมาตัดสต็อกรอบที่สอง และเปลี่ยนสถานะจาก `reversed` เป็น `issued` ส่งผลให้ผู้ใช้ได้รับพัสดุที่ผู้ดูแลระบบเคยตั้งใจปฏิเสธไปแล้ว
- **ผลกระทบ:** ข้อมูลสต็อกตัดผิดพลาด, พัสดุถูกสั่งจ่ายโดยไม่เจตนา, ขัดต่อคำสั่งไม่อนุมัติเดิม
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-actions.ts:275-278
  const linesRes = await tx.execute<DisbursementItemRow>(
    sql`SELECT * FROM public.disbursement_items
        WHERE disbursement_id = ${disbursementId} ORDER BY item_id ASC FOR UPDATE`
  )
  const lines = linesRes.rows // ไม่ได้กรอง status = 'pending'
  ...
  // features/disbursements/postgres-actions.ts:297-300
  const stockLedger = await tx.execute<{ net: number }>(sql`select coalesce(sum(delta),0)::int as net from public.stock_movements where disbursement_item_id=${line.id} and movement_type in ('issue','reversal')`)
  const materialNet = Number(stockLedger?.rows[0]?.net ?? 0)
  // รายการที่ถูกปฏิเสธ: issue (-1) + reversal (+1) = 0 ทำให้ materialAlreadyDebited เป็น false
  const materialAlreadyDebited = materialNet < 0 
  ...
  // ทำการตัดสต็อกรายการที่ถูกปฏิเสธซ้ำอีกครั้ง!
  if (currentItem.item_type === 'material' && !materialAlreadyDebited) {
    await tx.execute(sql`UPDATE public.materials SET quantity = quantity - ${line.requested_qty} ...`)
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `confirmPostgresDisbursement` ให้เลือกและประมวลผลเฉพาะรายการที่อยู่ในสถานะ `'pending'` เท่านั้น:
  ```typescript
  const pendingLines = lines.filter((l) => l.status === 'pending')
  if (pendingLines.length === 0) throw new Error('ไม่มีรายการที่รออนุมัติในเอกสารนี้')
  for (const line of pendingLines) { ... }
  ```

---

### [BUG-03] ครุภัณฑ์สูญหายจากการยืมคืน ถูกปรับเป็นสถานะพร้อมใช้ (Active) และคืนเข้าส่วนกลางใน `partialReturnPostgresDisbursement`

- **Severity:** Critical
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/postgres-actions.ts:1233-1243`
- **Function:** `partialReturnPostgresDisbursement`
- **Root Cause:**  
  ในฟังก์ชัน `partialReturnPostgresDisbursement` บรรทัดที่ 1233 มีการคำนวณสถานะใหม่ของครุภัณฑ์ดังนี้:  
  `const itemStatus = retItem.condition === 'damaged' ? 'damaged' : 'active'`  
  และบรรทัดที่ 1239 กำหนด `is_central = true` โดยไม่มีเงื่อนไข  
  หากมีการส่งสภาพครุภัณฑ์เป็นอย่างอื่น หรือมีการส่งสภาพ `'lost'` สถานะครุภัณฑ์จะถูกตั้งเป็น `'active'` และเปิดสถานะเป็น `'is_central = true'` ทันที (ต่างจาก `returnPostgresDisbursementItem` บรรทัดที่ 480-492 ที่กำหนดให้สถานะเป็น `'inactive'`, `quantity = 0`, และ `is_central = false`)
- **เงื่อนไขที่ทำให้เกิด Bug:**
  แอดมินบันทึกรับคืนครุภัณฑ์บางส่วนผ่านฟังก์ชัน `partialReturnPostgresDisbursement` โดยระบุสภาพครุภัณฑ์ที่สูญหาย
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ครุภัณฑ์ที่สูญหายต้องถูกปรับเป็นสถานะ `'inactive'`, จำนวนคงเหลือลดลงเหลือ 0, และต้องไม่ถูกนำเข้า Central Pool (`is_central = false`)
  - *Actual Behavior:* ครุภัณฑ์ที่สูญหายถูกบันทึกเป็นสถานะ `'active'` (พร้อมใช้งาน) และ `is_central = true` ทำให้โผล่กลับเข้ามาในรายการครุภัณฑ์ส่วนกลางที่เปิดให้ผู้อื่นยืมต่อได้ ทั้งที่ของสูญหายไปแล้ว
- **ผลกระทบ:** ทะเบียนครุภัณฑ์แสดงของที่มีอยู่จริงผิดพลาด ผู้ใช้อื่นสามารถกดขอยืมครุภัณฑ์ที่สูญหายไปแล้วได้
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-actions.ts:1233-1243
  const itemStatus = retItem.condition === 'damaged' ? 'damaged' : 'active'
  await tx.execute(
    sql`UPDATE public.items
        SET responsible_person = NULL,
            status = ${itemStatus},
            location_id = ${originLocation.id},
            is_central = true,
            note = ${centralNote},
            updated_at = now()
        WHERE id = ${retItem.item_id}`
  )
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ปรับปรุง Logic สถานะให้ครอบคลุมกรณีสูญหาย:
  ```typescript
  if (retItem.condition === 'lost') {
    await tx.execute(sql`
      UPDATE public.items 
      SET responsible_person = NULL, status = 'inactive', is_central = false, quantity = 0,
          note = CASE WHEN ${centralNote}::text IS NULL THEN 'บันทึกสูญหายจากการยืม' ELSE ${centralNote} || ' [บันทึกสูญหายจากการยืม]' END,
          updated_at = now() WHERE id = ${retItem.item_id}
    `)
  } else {
    const itemStatus = retItem.condition === 'damaged' ? 'damaged' : 'active'
    await tx.execute(sql`
      UPDATE public.items SET responsible_person = NULL, status = ${itemStatus},
          location_id = ${originLocation.id}, is_central = true, note = ${centralNote}, updated_at = now()
      WHERE id = ${retItem.item_id}
    `)
  }
  ```

---

### [BUG-04] การรับคืนครุภัณฑ์บางส่วน ล้างชื่อผู้ถือครองทันที และกรณีสูญหายล้างยอดคงเหลือทั้งหมดเป็น 0

- **Severity:** High
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/postgres-actions.ts:471-498`
- **Function:** `returnPostgresDisbursementItem`
- **Root Cause:**  
  1. เมื่อมีการรับคืนครุภัณฑ์บางส่วน (`newReturned < line.issued_qty`) ฟังก์ชัน `returnPostgresDisbursementItem` สั่ง `SET responsible_person = NULL` ทันทีในบรรทัดที่ 472, 482, 495 แม้ว่าผู้ยืมจะยังคืนไม่ครบและยังถือครองครุภัณฑ์ส่วนที่เหลืออยู่ก็ตาม  
  2. ในกรณีที่สภาพเป็น `'lost'` บรรทัดที่ 485 สั่ง `quantity = 0` แบบ Hardcode โดยไม่คำนึงว่าครุภัณฑ์ชิ้นนั้นมีจำนวนเท่าใด และสูญหายไปกี่หน่วย (เช่น มี 2 หน่วย สูญหาย 1 หน่วย ยอดจะถูกตัดเป็น 0 ทั้งหมดทันที)
- **เงื่อนไขที่ทำให้เกิด Bug:**
  1. การยืมครุภัณฑ์ที่มีจำนวนมากกว่า 1 หน่วย หรือมีการรับคืนทีละชิ้น
  2. การบันทึกรับคืนกรณีสูญหายสำหรับครุภัณฑ์ที่มีจำนวนหลายหน่วย
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ผู้ถือครอง (`responsible_person`) ต้องคงอยู่จนกว่าจะคืนครบตามจำนวนที่ยืม (`newReturned === line.issued_qty`) และกรณีสูญหายต้องตัดยอดลดลงตามจำนวนที่หายจริง (`quantity = quantity - return_qty`)
  - *Actual Behavior:* ชื่อผู้ถือครองถูกล้างออกเป็น `NULL` ทันทีตั้งแต่คืนชิ้นแรก และหากระบุสูญหาย ยอดครุภัณฑ์ทั้งหมดจะกลายเป็น 0 ทันที
- **ผลกระทบ:** ขาดความรับผิดชอบในการถือครองพัสดุ (Custody Loss), ครุภัณฑ์ส่วนที่เหลือที่ยังไม่คืนไม่มีชื่อผู้รับผิดชอบ, ยอดคงเหลือครุภัณฑ์หายไปจากระบบเกินจริง
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-actions.ts:481-496
  } else if (data.condition === 'lost') {
    await tx.execute(
      sql`UPDATE public.items 
          SET responsible_person = NULL, 
              status = 'inactive', 
              is_central = false,
              quantity = 0, -- ตัดเหลือ 0 ทันที ไม่สนใจ data.return_qty
              ...
    )
  } else {
    await tx.execute(
      sql`UPDATE public.items SET responsible_person = NULL, -- ล้างชื่อผู้ถือครองทันทีแม้ newReturned < line.issued_qty
          is_central = ${restoredToPool}, ...`
    )
  }
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ```typescript
  const isFullReturn = newReturned === line.issued_qty
  const newResponsible = isFullReturn ? null : item.responsible_person
  if (data.condition === 'lost') {
    const remainingQty = Math.max(0, item.quantity - data.return_qty)
    await tx.execute(sql`
      UPDATE public.items 
      SET responsible_person = ${newResponsible},
          status = ${remainingQty === 0 ? 'inactive' : item.status},
          quantity = ${remainingQty}, ...
    `)
  } else {
    await tx.execute(sql`
      UPDATE public.items 
      SET responsible_person = ${newResponsible},
          is_central = ${restoredToPool}, ...
    `)
  }
  ```

---

### [BUG-05] รายการย่อยค้างสถานะ 'pending' ตลอดกาลเมื่อเอกสารถูกปฏิเสธหรือยกเลิกทั้งฉบับ

- **Severity:** High
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** 
  - `features/disbursements/postgres-actions.ts:850-855` (`rejectPostgresDisbursement`)
  - `features/disbursements/postgres-actions.ts:234-236` (`cancelPostgresDisbursementDraft`)
- **Function:** `rejectPostgresDisbursement`, `cancelPostgresDisbursementDraft`
- **Root Cause:**  
  เมื่อเอกสารถูกปฏิเสธทั้งฉบับ (`rejectPostgresDisbursement`) หรือยกเลิกทั้งฉบับ (`cancelPostgresDisbursementDraft`) โค้ดทำการอัปเดตเฉพาะหัวเอกสาร `disbursements.status = 'rejected' / 'cancelled'` โดยไม่มีคำสั่งอัปเดตสถานะของรายการย่อยในตาราง `disbursement_items` แต่อย่างใด (ต่างจาก `partialRejectPostgresDisbursement` ที่อัปเดตเป็น `'reversed'`) ส่งผลให้รายการย่อยทั้งหมดในตาราง `disbursement_items` ค้างอยู่ที่สถานะ `'pending'` ตลอดไป
- **เงื่อนไขที่ทำให้เกิด Bug:**
  แอดมินกดปฏิเสธคำขอเบิก/ยืม หรือผู้ใช้กดยกเลิกคำขอเบิก
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* รายการย่อยทั้งหมดในเอกสารต้องเปลี่ยนสถานะตามหัวเอกสาร เช่น เป็น `'reversed'` หรือ `'cancelled'`
  - *Actual Behavior:* หัวเอกสารเป็น `rejected` หรือ `cancelled` แต่รายการย่อยในตาราง `disbursement_items` ยังคงเป็น `pending`
- **ผลกระทบ:** รายงานหรือ Query ที่ดึงข้อมูลระดับ Line Item เช่น รายการที่รออนุมัติค้างจ่าย จะดึงเอารายการที่ถูกปฏิเสธไปแล้วมารวมด้วย ทำให้ยอดสรุปรายการรอดำเนินการคลาดเคลื่อน
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-actions.ts:850-855
  await tx.execute(
    sql`UPDATE public.disbursements
        SET status = 'rejected',
            reversal_reason = ${reason || 'ไม่อนุมัติคำขอ'},
            updated_at = now()
        WHERE id = ${disbursementId}`
  ) // ไม่มีคำสั่ง UPDATE public.disbursement_items
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  เพิ่มคำสั่งอัปเดต Line Item ในทั้งสองฟังก์ชัน:
  ```typescript
  await tx.execute(
    sql`UPDATE public.disbursement_items SET status = 'reversed', updated_at = now() 
        WHERE disbursement_id = ${id} AND status = 'pending'`
  )
  ```

---

### [BUG-06] ใบเบิกพัสดุ (Print Voucher) แสดงจำนวนเป็น 0 และข้อมูลเป็นขีดว่างสำหรับคำขอที่รออนุมัติ

- **Severity:** High
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/print-generator.ts:46-68`
- **Function:** `generateDisbursementVoucherHtml`
- **Root Cause:**  
  ใน `print-generator.ts` บรรทัดที่ 47 กำหนดการดึงจำนวนที่เบิกไว้ดังนี้:  
  `const qty = doc.status === 'draft' ? item.requested_qty : item.issued_qty`  
  เมื่อผู้ใช้ส่งคำขอเบิกเข้ามา เอกสารจะอยู่ในสถานะ `pending_approval` (ไม่ใช่ `draft`) ทำให้ระบบเลือกใช้ `item.issued_qty` ซึ่งในขณะที่รออนุมัติ ยอด `issued_qty` จะยังคงเป็น `0`  
  นอกจากนี้ ฟิลด์ Snapshot เช่น `item_name_snapshot`, `category_name_snapshot`, `unit_name_snapshot` จะถูกบันทึกเมื่ออนุมัติแล้วเท่านั้น ส่งผลให้เอกสารพิมพ์ใบขอเบิกขณะรออนุมัติแสดงจำนวนเป็น 0 และชื่อ/หน่วยนับแสดงเป็นขีด `-`
- **เงื่อนไขที่ทำให้เกิด Bug:**
  ผู้ใช้หรือแอดมินกดพิมพ์ใบขอเบิกพัสดุหรือใบขอยืมสิ่งของในสถานะ `pending_approval` เพื่อนำไปเสนอลงนามในกระดาษจริง
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ใบขอเบิกต้องแสดงรายการสิ่งของ, จำนวนที่ขอเบิก (`requested_qty`), หน่วยนับ และราคาประมาณการ เพื่อใช้สำหรับเสนอผู้มีอำนาจลงนาม
  - *Actual Behavior:* ตารางรายการพัสดุพิมพ์ออกมาด้วยจำนวน `0`, ยอดรวมเป็น `0.00 บาท` และรายละเอียดชื่อ/หมวดหมู่เป็น `-`
- **ผลกระทบ:** ไม่สามารถพิมพ์ใบขอเบิกพัสดุเพื่อนำไปเสนอลงนามตามระเบียบงานสารบรรณ/พัสดุภาครัฐได้
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/print-generator.ts:46-51
  const tableRowsHtml = items.map((item, idx) => {
    const qty = doc.status === 'draft' ? item.requested_qty : item.issued_qty // pending_approval ได้ qty = 0
    const unitPrice = item.unit_price_snapshot ?? 0
    const rowTotal = qty * unitPrice
    totalQty += qty
    totalValue += rowTotal
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ปรับปรุงให้ดึง `requested_qty` เมื่อเอกสารยังไม่อนุมัติ:
  ```typescript
  const isUnconfirmed = ['draft', 'pending_approval'].includes(doc.status)
  const qty = isUnconfirmed ? item.requested_qty : item.issued_qty
  ```
  และใน `getPostgresDisbursementById` ให้ Coalesce ข้อมูล `unit_name`, `category_name`, `unit_price` จาก `inventory_items` หากยังไม่มี Snapshot

---

### [BUG-07] ผู้ใช้งานทั่วไปสามารถมองเห็นเอกสารเบิกจ่ายของทุกคนในหน่วยงานได้ (Missing Data Boundary)

- **Severity:** High
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** 
  - `features/disbursements/postgres-queries.ts:16-56` (`getPostgresDisbursements`)
  - `app/(dashboard)/disbursements/page.tsx:60-73`
- **Function:** `getPostgresDisbursements`
- **Root Cause:**  
  นโยบาย Row Level Security (RLS) ของตาราง `public.disbursements` อนุญาตให้ผู้ใช้ที่มีบทบาทในระบบอ่านข้อมูลได้ทั้งหมด (`USING (private.current_app_role() IS NOT NULL)`)  
  แต่ในส่วนของ Application Layer ฟังก์ชัน `getPostgresDisbursements` ที่ถูกเรียกใช้งานจากหน้า `/disbursements` ของผู้ใช้ทั่วไป ไม่มีการตรวจสอบและจำกัดเงื่อนไข `d.created_by = profile.id` ส่งผลให้ผู้ใช้ทั่วไปทุกคนเมื่อเข้าสู่แท็บรายการเอกสาร จะมองเห็นประวัติการเบิกจ่าย รายชื่อผู้รับ เหตุผลการเบิก และเอกสารของบุคลากรคนอื่นๆ ทั้งหมดในองค์กร
- **เงื่อนไขที่ทำให้เกิด Bug:**
  ผู้ใช้บทบาท `user` ล็อกอินเข้าใช้งานและเปิดหน้า `/disbursements`
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ผู้ใช้ทั่วไปควรมีสิทธิ์มองเห็นเฉพาะเอกสารคำขอเบิก/ยืมที่ตนเองเป็นผู้สร้าง หรือที่ตนเองเป็นผู้รับมอบหมายเท่านั้น
  - *Actual Behavior:* ผู้ใช้ทั่วไปสามารถมองเห็นเอกสารเบิกจ่ายของทุกแผนกและทุกคนในองค์กรได้ทั้งหมด
- **ผลกระทบ:** ละเมิดหลักการ Data Privacy และ Least Privilege ในระบบราชการ ผู้ใช้สามารถล่วงรู้ข้อมูลการจัดซื้อจัดจ้างและการเบิกใช้พัสดุภายในของผู้อื่นได้
- **หลักฐานจาก Code Path:**
  ```typescript
  // features/disbursements/postgres-queries.ts:28-54
  const clauses: SQL[] = []
  if (params.historyOnly) { ... }
  // ไม่มีเงื่อนไขตรวจสอบ role หรือกรอง created_by สำหรับผู้ใช้ธรรมดา
  const whereSql = clauses.length > 0 ? sql`WHERE ${sql.join(clauses, sql` and `)}` : sql``
  ```
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `getPostgresDisbursements` ให้ดึง Profile ปัจจุบันและเพิ่มเงื่อนไขเมื่อไม่ใช่ Admin:
  ```typescript
  const profile = await getCurrentProfile()
  if (profile && profile.role !== 'admin') {
    clauses.push(sql`d.created_by = ${profile.id}::uuid`)
  }
  ```

---

### [BUG-08] การรับคืนครุภัณฑ์ผ่านโมดูล Custody ทำให้เอกสารยืมคงค้างสถานะ Active Borrow และแจ้งเตือน Overdue ตลอดไป

- **Severity:** Medium
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/custody-postgres.ts:404-453`
- **Function:** `returnPostgresCustody`
- **Root Cause:**  
  ฟังก์ชัน `returnPostgresCustody` ในโมดูลจัดการผู้ถือครอง (Custody Management) อนุญาตให้แอดมินรับคืนครุภัณฑ์เข้าสู่ส่วนกลางได้โดยตรง (`is_central = true`, `responsible_person = NULL`) โดยไม่มีการตรวจสอบว่าครุภัณฑ์ชิ้นนั้นกำลังผูกอยู่กับเอกสารการยืม (`disbursements.transaction_type = 'asset_borrow'` และ `status = 'active_borrow'`) หรือไม่  
  เมื่อรับคืนผ่านช่องทางนี้ ตัวครุภัณฑ์ถูกปรับเข้าส่วนกลางแล้ว แต่เอกสารการยืมในตาราง `disbursements` ยังคงค้างอยู่ที่สถานะ `active_borrow` และตาราง `disbursement_items.returned_qty` ยังคงเป็น 0
- **เงื่อนไขที่ทำให้เกิด Bug:**
  แอดมินรับคืนครุภัณฑ์ที่ถูกยืมผ่านหน้าจัดการสิทธิ์การถือครอง (Custody) แทนที่จะกดรับคืนในหน้าเอกสารการยืม (Disbursements)
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ระบบต้องแจ้งเตือนว่าครุภัณฑ์นี้อยู่ระหว่างการยืมตามสัญญา/เอกสาร และแนะนำให้ไปบันทึกรับคืนที่หน้าเอกสารยืม หรือทำการอัปเดตปิดเอกสารยืมให้อัตโนมัติ
  - *Actual Behavior:* ครุภัณฑ์กลับมาอยู่ในคลังส่วนกลาง แต่เอกสารยืมยังค้างสถานะกำลังยืม และจะกลายเป็นรายการ "ยืมเกินกำหนด (Overdue)" ค้างอยู่ใน Admin Work Queue ตลอดไป
- **ผลกระทบ:** งานค้างใน Admin Queue หลอกตา, ข้อมูลสถานะเอกสารไม่สอดคล้องกับสถานะจริงของสิ่งของ
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `returnPostgresCustody` ให้ตรวจสอบเอกสารยืมที่ค้างอยู่:
  ```typescript
  const activeBorrow = await tx.execute<{ id: string; line_id: string }>(sql`
    SELECT d.id, di.id as line_id FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    WHERE di.item_id = ${data.item_id} AND d.status IN ('active_borrow', 'partially_returned')
      AND di.status NOT IN ('returned', 'reversed') LIMIT 1
  `)
  if (activeBorrow.rows[0]) {
    throw new Error('ครุภัณฑ์นี้อยู่ระหว่างการยืมตามเอกสาร กรุณาบันทึกรับคืนผ่านเมนู "เบิก-จ่ายและยืม" ที่เอกสารดังกล่าว')
  }
  ```

---

### [BUG-09] การย้อนรายการส่งมอบครุภัณฑ์ระหว่างบุคคล กำหนดให้เป็นของส่วนกลางทั้งที่มีผู้ถือครองเดิม

- **Severity:** Medium
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/postgres-actions.ts:670-672`
- **Function:** `reversePostgresDisbursement`
- **Root Cause:**  
  เมื่อมีการทำรายการส่งมอบครุภัณฑ์ (`asset_handover`) จากนาย A ให้นาย B แล้วแอดมินสั่งย้อนรายการ (`reversePostgresDisbursement`) โค้ดจะดึงผู้ถือครองเดิมจาก `asset_custody_logs` มาใส่กลับใน `responsible_person = 'นาย A'` แต่บรรทัดที่ 670 มีการ Hardcode กำหนด `is_central = true` และเติม `[ของส่วนกลาง]` ลงใน Note เสมอ ทำให้เกิดสถานะขัดแย้งกันเอง (มีผู้ถือครองส่วนบุคคลคือนาย A แต่ถูกระบุว่าเป็นของส่วนกลางพร้อมให้ผู้อื่นยืม)
- **เงื่อนไขที่ทำให้เกิด Bug:**
  ย้อนรายการเอกสารส่งมอบครุภัณฑ์ (Asset Handover) ที่ผู้ถือครองเดิมเป็นบุคคล ไม่ใช่ส่วนกลาง
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* หากผู้ถือครองเดิมไม่ใช่ส่วนกลาง (`prevPerson !== null`) ครุภัณฑ์ต้องมีสถานะ `is_central = false`
  - *Actual Behavior:* ครุภัณฑ์ถูกอัปเดตให้ `responsible_person = prevPerson` พร้อมกับ `is_central = true`
- **ผลกระทบ:** ครุภัณฑ์ส่วนบุคคลถูกแสดงในแคตตาล็อกของส่วนกลาง ทำให้ผู้ใช้อื่นสามารถกดขอยืมของที่นาย A ถือครองอยู่ได้
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ```typescript
  const isNowCentral = prevPerson === null
  await tx.execute(sql`
    UPDATE public.items 
    SET responsible_person = ${prevPerson},
        is_central = ${isNowCentral},
        note = ${syncCentralNote(item.note || '', isNowCentral)},
        updated_at = now() 
    WHERE id = ${item.id}
  `)
  ```

---

### [BUG-10] สรุปสถานะชุดคำขอ (Batch Summary) แสดง 'ดำเนินการบางส่วน' ตลอดไป สำหรับชุดคำขอผสมที่เสร็จสมบูรณ์แล้ว

- **Severity:** Medium
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/disbursements/request-batch.ts:16-22`
- **Function:** `batchSummary`
- **Root Cause:**  
  ฟังก์ชัน `batchSummary` ตรวจสอบสถานะชุดคำขอที่เสร็จสิ้นด้วยเงื่อนไข:  
  `if (statuses.every(s => ['returned', 'reversed', 'cancelled', 'rejected'].includes(s))) return 'สิ้นสุดแล้ว'`  
  สำหรับเอกสารเบิกจ่ายวัสดุ (`material_issue`) สถานะสิ้นสุดของการเบิกคือ `'confirmed'` (จ่ายพัสดุเรียบร้อย)  
  เมื่อผู้ใช้ส่งคำขอแบบผสม (มีทั้งยืมครุภัณฑ์และเบิกวัสดุ) แล้วครุภัณฑ์ถูกคืนครบแล้ว (`'returned'`) และวัสดุถูกจ่ายเรียบร้อย (`'confirmed'`) อาร์เรย์ของสถานะคือ `['returned', 'confirmed']` ซึ่งไม่ตรงกับเงื่อนไขบรรทัดที่ 19 ทำให้โค้ดไหลไปตกที่บรรทัดที่ 20 `if (new Set(statuses).size > 1) return 'ดำเนินการบางส่วน'`
- **เงื่อนไขที่ทำให้เกิด Bug:**
  คำขอแบบ Cart/Batch ที่มีทั้งวัสดุและครุภัณฑ์ เมื่อวัสดุจ่ายแล้วและครุภัณฑ์คืนครบแล้ว
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ชุดคำขอต้องแสดงสถานะเป็น `'สิ้นสุดแล้ว'`
  - *Actual Behavior:* ชุดคำขอแสดงสถานะเป็น `'ดำเนินการบางส่วน'` ตลอดไป
- **ผลกระทบ:** ผู้ใช้และผู้ดูแลระบบเกิดความสับสน เข้าใจว่ายังมีรายการตกค้างที่ยังดำเนินการไม่เสร็จ
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `batchSummary` ให้รวมสถานะ `'confirmed'` เป็นหนึ่งในสถานะที่สิ้นสุดแล้ว:
  ```typescript
  const terminalStatuses = ['confirmed', 'returned', 'reversed', 'cancelled', 'rejected']
  if (statuses.every(s => terminalStatuses.includes(s))) return 'สิ้นสุดแล้ว'
  ```

---

### [BUG-11] การแก้ไขสถานะสิ่งของแบบกลุ่ม (Bulk Edit) ข้ามการตรวจสอบคำขอเบิกหรือการยืมที่ค้างอยู่

- **Severity:** Medium
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/items/postgres-actions.ts:142-154`
- **Function:** `mutatePostgresItems`
- **Root Cause:**  
  ในฟังก์ชัน `mutatePostgresItems` เมื่อแอดมินทำการอัปเดตแบบกลุ่ม (`operation === 'update'`) และมีการส่งค่า `status` (เช่น เปลี่ยนเป็น `'damaged'`, `'inactive'`, `'disposed'`) โค้ดจะอัปเดตลงตาราง `items` และ `materials` โดยตรงทันที โดยไม่มีการเรียกตรวจสอบว่าสิ่งของที่เลือกกำลังมีคำขอเบิกรออนุมัติ หรือกำลังถูกยืมอยู่หรือไม่ (ต่างจาก `archivePostgresItems` ที่มี `ItemArchiveBlockedError`)
- **เงื่อนไขที่ทำให้เกิด Bug:**
  แอดมินเลือกสิ่งของในตารางแล้วกดแก้ไขกลุ่ม เปลี่ยนสถานะเป็นชำรุดหรือจำหน่ายออก ในขณะที่สิ่งของนั้นกำลังมีผู้ขอยืมหรือขอเบิกรอการอนุมัติอยู่
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* ระบบต้องปฏิเสธการเปลี่ยนสถานะสิ่งของที่กำลังมี Transaction ค้างอยู่
  - *Actual Behavior:* สถานะสิ่งของเปลี่ยนเป็นชำรุด/ไม่พร้อมใช้ทันที เมื่อแอดมินเข้ามาจะอนุมัติใบเบิก คำขอจะเกิด Error ล้มเหลวไม่สามารถอนุมัติได้ (`รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน`)
- **ผลกระทบ:** เอกสารเบิกจ่ายค้างเติ่งในระบบ ไม่สามารถอนุมัติหรือดำเนินการต่อไปได้
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `mutatePostgresItems` กรณีที่มีการส่ง `changes.status` เข้ามา ให้เพิ่มคำสั่งตรวจสอบคำขอค้างก่อนทำการอัปเดต:
  ```typescript
  if (changes.status && !['active', 'spare'].includes(changes.status)) {
    const blocked = await tx.execute(sql`
      SELECT 1 FROM public.disbursement_items di
      JOIN public.disbursements d ON d.id = di.disbursement_id
      WHERE di.item_id IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})
        AND d.status IN ('pending_approval', 'active_borrow', 'partially_returned')
        AND di.status NOT IN ('returned', 'reversed') LIMIT 1
    `)
    if (blocked.rows.length) {
      throw new Error('ไม่สามารถเปลี่ยนสถานะสิ่งของที่กำลังมีคำขอรออนุมัติหรืออยู่ระหว่างการยืมได้')
    }
  }
  ```

---

### [BUG-12] การลบข้อมูลผ่านหน้า Admin Table Management เป็นการ Hard Delete และไม่มี Audit Trail

- **Severity:** Low
- **Confidence:** Confirmed (พิสูจน์แล้วจาก Code Path)
- **File Path & Line Number:** `features/admin/postgres-admin.ts:117-131`
- **Function:** `pgDeleteTableRow`
- **Root Cause:**  
  ฟังก์ชัน `pgDeleteTableRow` ในหน้าจัดการตารางระบบของแอดมิน ทำการรันคำสั่ง `DELETE FROM ...` (Hard Delete) กับตาราง `items` และ `materials` โดยตรง หากรายการนั้นยังไม่มีประวัติในตารางที่มี Foreign Key ป้องกัน ข้อมูลสิ่งของจะถูกลบหายไปจากฐานข้อมูลทันที โดยไม่ได้ผ่านกลไก Soft Delete (`deleted_at = now()`) และไม่มีการบันทึกประวัติการลบลงใน `audit_logs`
- **เงื่อนไขที่ทำให้เกิด Bug:**
  แอดมินเข้าไปลบสิ่งของผ่านเมนู Admin Settings -> Table Management
- **Expected Behavior vs Actual Behavior:**
  - *Expected Behavior:* การลบพัสดุในระบบพัสดุภาครัฐต้องเป็นการ Soft Delete เสมอ และต้องมีบันทึก Audit Log ระบุว่าใครเป็นผู้ลบ
  - *Actual Behavior:* ข้อมูลถูกลบถาวรจากฐานข้อมูล และไม่มี Audit Log บันทึกการกระทำนี้
- **ผลกระทบ:** สูญเสียความสามารถในการสืบสวนย้อนหลัง (Non-repudiation)
- **แนวทางแก้ไขที่กระทบระบบน้อยที่สุด:**
  ใน `pgDeleteTableRow` หาก `tableName` เป็น `items` หรือ `materials` ให้เรียกใช้ `archivePostgresItems` แทนคำสั่ง `DELETE FROM` ดิบ

---

## สรุปภาพรวมและสถิติการตรวจสอบ (Audit Statistics)

- **จำนวน Confirmed Bugs ที่พิสูจน์ได้จาก Code Path จริง:** **12 รายการ**
- **จำนวน Potential Issues / Theoretical Risks:** **0 รายการ** (ทุกรายการที่รายงานมีหลักฐานยืนยันจากโค้ดจริง ไม่มีการคาดเดา)

---

## Top 5 ปัญหาที่ต้องแก้ไขเร่งด่วนก่อน Production Release

1. **[BUG-01] แก้ไข `cancelPostgresDisbursementDraft`:** เพิ่มการป้องกันไม่ให้ยกเลิกเอกสารที่มีรายการย่อยจ่ายพัสดุออกไปแล้ว เพื่อป้องกันสต็อกงอกซ้ำซ้อน (Ghost Stock) และครุภัณฑ์สูญหาย
2. **[BUG-02] แก้ไข `confirmPostgresDisbursement`:** กรองเฉพาะรายการ `status = 'pending'` ในการอนุมัติ เพื่อป้องกันการนำรายการที่ปฏิเสธแล้วกลับมาตัดสต็อกและสั่งจ่ายซ้ำ
3. **[BUG-03] แก้ไข `partialReturnPostgresDisbursement`:** ตรวจสอบสภาพ `'lost'` และปรับสถานะเป็น `inactive`, `quantity = 0`, `is_central = false` ไม่ให้ครุภัณฑ์สูญหายฟื้นกลับมาเป็น Active ในส่วนกลาง
4. **[BUG-06] แก้ไข `print-generator.ts`:** ปรับ Logic ให้ดึง `requested_qty` เมื่อเอกสารอยู่ในสถานะ `pending_approval` เพื่อให้พิมพ์ใบขอเบิกพัสดุไปเสนอลงนามได้ถูกต้อง
5. **[BUG-07] แก้ไข `getPostgresDisbursements`:** เพิ่มเงื่อนไขจำกัดสิทธิ์ให้ผู้ใช้ทั่วไปมองเห็นเฉพาะเอกสารคำขอของตนเอง เพื่อปกป้องความเป็นส่วนตัวของข้อมูลตามหลักสิทธิ์ความปลอดภัย

---

## สรุปความพร้อมในการขึ้นระบบ (Production Logic Readiness)

### ⛔ **CONDITIONAL GO**

**เงื่อนไข:**  
ระบบมีความพร้อมด้านสถาปัตยกรรม (Database Triggers, Row Locking, NFC Normalization, Foreign Key Protections) อยู่ในเกณฑ์ดีมาก แต่ยังมี **Logic Flaws ใน State Machine ของการเบิกจ่ายและการคืนพัสดุ** โดยเฉพาะกระบวนการ Partial Approval / Partial Rejection / Partial Return  
**ไม่อนุมัติให้ขึ้นระบบจริง (Production Release) จนกว่าจะทำการแก้ไขข้อบกพร่องระดับ Critical และ High (BUG-01 ถึง BUG-07) ให้แล้วเสร็จ**

---

## รายการที่ยังไม่ได้ตรวจสอบหรืออยู่นอกเหนือขอบเขต (Unchecked Scope)

1. **การตั้งค่า Reverse Proxy / Load Balancer ระดับ Production Server จริง** (การจัดการ HTTP Header, IP Spoofing ผ่าน `x-forwarded-for`)
2. **ประสิทธิภาพของฐานข้อมูลเมื่อมีข้อมูลจริงระดับ 1,000,000+ รายการ** (Large-scale EXPLAIN ANALYZE on cold cache)
3. **การเชื่อมต่อกับระบบภายนอกจริง (Live Third-party SSO Provider)** (ตรวจสอบเฉพาะการ Verify JWT ในโค้ดปัจจุบัน)
