# งานที่ยังไม่สมบูรณ์หลังตรวจ Business Logic

วันที่ตรวจ: 2026-11-15

เอกสารต่อจาก `2026-11-15-business-logic-handoff.md` สำหรับ agent ผู้ลงมือแก้ ผู้จัดทำเป็นผู้วิเคราะห์และตรวจงาน ผู้ใช้ต้องการประหยัด usage ให้แก้เฉพาะขอบเขตนี้

## ผลตรวจโดยรวม

ยังไม่ผ่านเกณฑ์ปิดงาน: ข้อปัญหาการติดตามคำขอที่ไม่อนุมัติยังแก้ไม่ครบ และชุดทดสอบเฉพาะส่วนยังมี 3 ข้อไม่ผ่าน

การตรวจรอบนี้เป็นการอ่าน diff และรันทดสอบในเครื่อง ยังไม่ได้ทดสอบกับฐานข้อมูลจริงหรือ browser ที่เข้าสู่ระบบ

## 1. ต้องแก้ต่อ: คำขอ rejected ยังเข้าถึงไม่ได้จากหน้าปกติ

### หลักฐาน

ใน `features/disbursements/postgres-queries.ts` ฟังก์ชัน `getPostgresDisbursements()` ปรับเป็น:

```ts
if (params.historyOnly) {
  clauses.push(sql`d.status in (${completedStatuses})`)
} else if (params.hideCompleted) {
  clauses.push(sql`d.status not in (${completedStatuses})`)
} else if (!params.status) {
  clauses.push(sql`d.status <> 'rejected'`)
}
```

การแก้ช่วยให้ส่ง `status=rejected` โดยตรงแล้วไม่ชนกับเงื่อนไขตัด rejected แต่เมื่อเปิด “รายการของฉัน” ตามปกติ หรือเลือกสถานะทั้งหมด จะไม่ได้ส่งสถานะเฉพาะ จึงยังตัด rejected ออก

ใน `features/disbursements/components/disbursement-list-client.tsx` ตัวเลือก `DISBURSEMENT_STATUS_OPTIONS` สำหรับรายการของผู้ใช้มีเพียง `pending_approval` และ `active_borrow` ไม่มี “ไม่อนุมัติ” ขณะที่ `HISTORY_STATUS_OPTIONS` ไม่ใช่ตัวกรองของหน้ารายการผู้ใช้ทั่วไป

### ผลกระทบ

ผู้ใช้ที่ถูกปฏิเสธคำขอยังไม่เห็นคำขอนั้นจากรายการปกติ และไม่มีตัวกรองใน UI ให้เข้าดู การให้ผู้ใช้แก้ URL เองไม่ถือว่าตรงเกณฑ์ handoff

### สิ่งที่ต้องทำ

1. ให้รายการของผู้ขอรวมคำขอ rejected ที่ผู้ใช้มีสิทธิ์อ่าน เมื่อเลือกทั้งหมดหรือเปิดรายการปกติ
2. เพิ่มทางเลือก “ไม่อนุมัติ” ในตัวกรองที่ผู้ใช้เข้าถึงได้
3. ตรวจว่ากดเข้าไปดูเหตุผลปฏิเสธจาก `reversal_reason` ได้ ใช้หน้ารายละเอียดเดิมหากรองรับแล้ว
4. รักษาการแยกคิวอนุมัติด้วย `hideCompleted`: rejected และรายการที่จบแล้วต้องไม่กลับเข้าคิว
5. คง RLS/RBAC เดิม ห้ามใช้ admin/service-role เพื่อเลี่ยงสิทธิ์

### เกณฑ์ทดสอบ

- ผู้ขอเปิด “รายการของฉัน” ตามปกติแล้วเห็นคำขอ rejected ของตนเอง
- เลือก “ไม่อนุมัติ” แล้วเห็นเฉพาะรายการที่ตรงสถานะและมีสิทธิ์อ่าน
- เลือก “ทั้งหมด” แล้ว rejected ไม่หายไปอีก
- หน้ารายละเอียดแสดงเหตุผลปฏิเสธที่บันทึกไว้
- คิวอนุมัติไม่รวม rejected หรือสถานะที่จบแล้ว
- ผู้ใช้ไม่มีสิทธิ์อ่านคำขอของผู้อื่นตามกติกาเดิม

เพิ่ม regression test ที่ตรวจพฤติกรรม query และ UI จริง อย่าใช้เพียงการค้นข้อความ source code

## 2. ต้องตรวจต่อ: ชุดทดสอบเฉพาะส่วนยังไม่ผ่าน

คำสั่งที่รัน:

```text
node --max-old-space-size=2048 --import tsx --test tests/component/disbursement-list.test.tsx tests/unit/disbursement-validation.test.ts
```

ผล: 14 tests, ผ่าน 11, ไม่ผ่าน 3

รายการที่ไม่ผ่านใน `tests/component/disbursement-list.test.tsx`:

1. `DisbursementListClient renders DataTable and rows when items exist` — ยังตรวจว่าต้องมีหัวตาราง `ID` ซึ่งไม่ตรงกับตารางปัจจุบัน
2. `approval tab hides history shortcut and can show all statuses using the status filter` — หา label `กรองตามสถานะเอกสาร` ไม่พบในแท็บอนุมัติ
3. `choosing all statuses and clearing filters never returns to catalog or pending default` — หา label ตัวกรองสถานะดังกล่าวไม่พบเช่นกัน

สามข้อนี้ไม่ได้พิสูจน์ว่าเกิดจาก patch สองจุดล่าสุด เพราะ working tree มีการเปลี่ยน UI ก่อนหน้าอยู่แล้ว ผู้รับงานต้องเทียบข้อกำหนด UI ล่าสุดกับ test ก่อนปรับ ห้ามลบ assertion หรือแก้ production ย้อนกลับเพื่อให้ test ผ่านโดยไม่ตรวจเจตนา

### ข้อกำหนด UI ที่ต้องรักษา

- ประวัติการอนุมัติอยู่ใน dropdown “การทำรายการ” ของ Logs
- ใช้ตาราง audit logs และรายละเอียดก่อน–หลังแบบเดียวกับ Logs อื่น
- ใช้สีม่วงสำหรับกลุ่มประวัติการอนุมัติ
- หน้า Logs ไม่มีปุ่ม “ล้างตัวกรอง” ตามที่ผู้ใช้สั่ง
- อย่านำตารางเอกสารเบิก–ยืมมาแทนตาราง Logs อีก

ปรับ tests ให้ตรวจพฤติกรรมที่ยังจำเป็นตาม UI ปัจจุบัน และเพิ่ม coverage ของ rejected ตามข้อ 1 แทนการคงข้อคาดหวังที่ล้าสมัย

## ส่วนที่ตรวจแล้วตรงตามข้อเสนอ

`features/disbursements/postgres-actions.ts` ใน `confirmPostgresDisbursement()` เปลี่ยน audit `old_data.status` จากค่าคงที่ `'draft'` เป็น `doc.status` แล้ว ตรงกับสถานะเอกสารที่อ่านและล็อกไว้ก่อนอนุมัติ

ยังควรมี regression test แยกกรณีอนุมัติจาก `pending_approval` และยืนยันจาก `draft` เพื่อยืนยัน audit payload จริง ขณะตรวจรอบนี้ยังไม่มีหลักฐานผลทดสอบฐานข้อมูลของสองกรณีนี้

กติกาห้ามคืนก่อนกำหนดยังไม่ได้เปลี่ยน เป็นประเด็นรอยืนยันนโยบาย ไม่ต้องแก้เองในงานนี้

## ผลตรวจอื่นที่รันแล้ว

```text
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

ผ่าน

```text
npm run lint -- features/disbursements/postgres-actions.ts features/disbursements/postgres-queries.ts
```

ผ่านเฉพาะสองไฟล์ที่ระบุ ไม่ได้หมายถึง lint ทั้ง repository ผ่าน

## วิธีส่งงานกลับ

ดูสถานะและ diff ปัจจุบันก่อนแก้ ห้ามทับหรือย้อนงานอื่นของผู้ใช้ ไม่ขยาย audit ไม่เปลี่ยน schema หรือ permission และไม่ทดลอง mutation กับ production

เมื่อแก้เสร็จ ส่งสรุปไฟล์ที่เปลี่ยน ผลทดสอบจริง และสิ่งที่ยังไม่ได้ตรวจ ให้ผู้วิเคราะห์ตรวจ diff อีกครั้งก่อนปิดงาน ไม่ต้อง commit/push/deploy ในขอบเขตนี้
