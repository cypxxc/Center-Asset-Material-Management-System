# Bug Fix Report (รายงานการสืบสวนและแก้ไขข้อผิดพลาด)
**ระบบ:** Center Asset Material Management System (CAMMS)  
**วันที่ดำเนินการ:** 15 พฤศจิกายน 2569

---

## 1. ข้อผิดพลาดที่ตรวจพบและได้รับการแก้ไขในรอบนี้

### Bug #1: ขาดบัญชีผู้ใช้จริงและรหัสผ่านสำหรับรัน Production UAT
- **สาเหตุรากเหง้า (Root Cause):**
  ในฐานข้อมูลเดิม รหัสผ่านของบัญชีผู้ใช้ในตาราง `profiles` มีค่าเป็น `null` ทำให้ไม่สามารถล็อกอินผ่านฟอร์มหน้าเว็บจริงได้ (เดิมออกแบบสำหรับระบบ Development Header หรือ Seed ชั่วคราว)
- **การแก้ไข (Resolution):**
  - สร้างสคริปต์ `scripts/setup-uat-accounts.ts` โดยเชื่อมต่อผ่าน Owner Pool (`DATABASE_MIGRATION_URL`)
  - อัปเดต Trigger การตั้งรหัสผ่านที่ถูกต้องสำหรับ Admin (`Admin1234!`)
  - สร้างบัญชีทดสอบระดับผู้ใช้ทั่วไป `uat_user@camms.local` (`User1234!`) สำหรับทดสอบบทบาท RBAC

### Bug #2: Playwright Timeout ระหว่างการรอ Network Idle เนื่องจาก SSE EventStream
- **สาเหตุรากเหง้า (Root Cause):**
  ระบบมีฟังก์ชัน Realtime Update ผ่าน Server-Sent Events (SSE) `/api/events` ซึ่งเป็น Persistent Connection ส่งผลให้การตั้งค่ารอหน้าเว็บด้วย `networkidle` เกิด Timeout เพราะการเชื่อมต่อสตรีมข้อมูลไม่เคยจบลง
- **การแก้ไข (Resolution):**
  - ปรับการรอโหลดหน้าเว็บในเบราว์เซอร์อัตโนมัติมาใช้ `domcontentloaded` ร่วมกับ selector assertion ทำให้การทดสอบใน Real Browser รันได้รวดเร็ว แม่นยำ และทำงานสอดคล้องกับพฤติกรรมจริงของผู้ใช้งาน

---

## 2. ข้อบกพร่องทางตรรกะที่ตรวจพบและเตรียมพร้อมสำหรับรอบการพัฒนาถัดไป (Documented Defects)
1. **Disbursement Early Return Constraint:**
   - ได้บันทึกรายละเอียดข้อผิดพลาดของการบล็อกการคืนพัสดุก่อนถึงกำหนดวันคืนไว้ใน `docs/BUSINESS_LOGIC_AUDIT_REPORT.md`
2. **Missing Dark Mode Token Selectors:**
   - บันทึกการขาดหายไปของ selector `.dark, [data-theme="dark"]` ใน `globals.css`
