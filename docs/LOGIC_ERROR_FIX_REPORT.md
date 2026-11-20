# รายงานผลการแก้ไข CAMMS Business Logic Bugs

อ้างอิง [LOGIC_ERROR_AUDIT.md](./LOGIC_ERROR_AUDIT.md) สถานะในตารางอ้างอิงจากการอ่านซอร์สโค้ดและการแก้ไขในโปรเจกต์

| BUG-ID | Status | Files Changed | ผลการตรวจและแก้ไข |
|---|---|---|---|
| BUG-01 | ALREADY FIXED | — | การยกเลิกทั้งฉบับตรวจว่ามีรายการที่จ่ายแล้วก่อนเปลี่ยนสถานะเอกสาร |
| BUG-02 | ALREADY FIXED | — | การยืนยันดำเนินการเฉพาะรายการสถานะ `pending` |
| BUG-03 | ALREADY FIXED | — | การรับคืนที่ระบุว่าสูญหายตั้งสถานะเป็น `inactive` ปรับจำนวนเป็น 0 และกันออกจากส่วนกลาง |
| BUG-04 | ALREADY FIXED | — | การรับคืนบางส่วนคงผู้ถือครองไว้จนกว่าจะคืนครบ และลดจำนวนตามที่สูญหาย |
| BUG-05 | FIXED | `features/disbursements/postgres-actions.ts`<br>`db/postgres/migrations/0001_reverse_closed_request_lines.sql`<br>`db/postgres/migrations/meta/_journal.json` | เพิ่ม Trigger ให้เปลี่ยนรายการค้างเป็น `reversed` เมื่อยกเลิกหรือปฏิเสธทั้งฉบับ รวมถึงกรณีเจ้าของคำขอเป็นผู้ยกเลิก มีผลเมื่อใช้ Forward Migration |
| BUG-06 | FIXED | `features/disbursements/postgres-queries.ts` | ใช้ราคาปัจจุบันของรายการที่ยังไม่จ่ายเมื่อเอกสารเป็นฉบับร่างหรือรออนุมัติและราคาจาก Snapshot ว่างหรือเป็น 0 ใบเบิกใช้จำนวนที่ขอเบิกอยู่แล้ว |
| BUG-07 | ALREADY FIXED | — | ฝั่ง Server จำกัดเอกสารสำหรับผู้ใช้ทั่วไปตาม `created_by` ผู้ดูแลระบบดูเอกสารได้ทั้งหมด |
| BUG-08 | ALREADY FIXED | — | โมดูล Custody ป้องกันการรับคืนครุภัณฑ์ที่ยังอยู่ระหว่างยืมและแนะนำให้รับคืนผ่านเอกสารยืม |
| BUG-09 | ALREADY FIXED | — | การย้อนรายการคืนผู้ถือครองเดิมและตั้งเป็นส่วนกลางเฉพาะเมื่อไม่มีผู้ถือครองเดิม |
| BUG-10 | ALREADY FIXED | — | ชุดคำขอที่เอกสารทุกฉบับสิ้นสุดแล้วแสดงสถานะ «สิ้นสุดแล้ว» |
| BUG-11 | FIXED | `features/items/postgres-actions.ts` | ใช้ Lock เดียวกับงานเบิกและยืมก่อนตรวจรายการค้างเมื่อแก้ไขสถานะเป็นไม่พร้อมใช้งาน และข้ามรายการที่ถูกย้อนสถานะแล้ว |
| BUG-12 | ALREADY FIXED | — | การลบครุภัณฑ์และวัสดุผ่านหน้าจัดการตารางใช้ Soft Delete และบันทึก Audit Log |

**Fixed 3 · Already Fixed 9 · Blocked 0 · Files Changed 5** (นับเฉพาะไฟล์ที่แก้ไขเพื่อแก้บั๊ก)

**ไม่ได้รัน Tests, Build, Lint, Typecheck หรือ Migration ตามคำสั่ง** และไม่ได้เปลี่ยนข้อมูลในฐานข้อมูล
