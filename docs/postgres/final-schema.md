# Final PostgreSQL baseline

ไฟล์ db/postgres/migrations/0000_final_schema.sql เป็นชุดเริ่มต้นสำหรับฐานข้อมูลว่าง
ติดตั้งผ่าน npm run postgres:app:setup หลังเตรียม PostgreSQL ตาม [คู่มือติดตั้ง](../../AGENT_SETUP.md)

ต้องแจกจ่ายไฟล์ทั้งสามรายการพร้อมกัน:

- db/postgres/migrations/0000_final_schema.sql
- db/postgres/migrations/meta/_journal.json
- db/postgres/migrations/meta/0000_snapshot.json

## สิ่งที่รวมอยู่

Baseline รวม 15 ตารางใน public และ private_auth พร้อม foreign keys, constraints,
indexes, RLS policies, grants, audit triggers และ stored functions ที่ระบบใช้

- บัญชีผู้ใช้มีอีเมลเป็น NULL ได้ และยังเข้าสู่ระบบด้วยชื่อหรือ UUID ได้
- อีเมลจริงยังถูกตรวจไม่ให้ซ้ำโดยไม่แยกตัวพิมพ์ใหญ่–เล็ก
- รองรับบทบาท admin และ user ตามระบบปัจจุบัน
- รวมการป้องกันคำขอ การอนุมัติ การคืน และรายการพัสดุซ้ำในเอกสารเดียวกัน
- ไม่มีบัญชี รหัสผ่าน เซสชัน หรือข้อมูลธุรกิจของผู้พัฒนารวมอยู่ในไฟล์
- Setup สร้างบัญชีผู้ดูแลและรหัสผ่านในเครื่องที่ติดตั้งเอง

การติดตั้งมี ledger เพียงรายการเดียวของ baseline การรัน migration ซ้ำจะไม่สร้างรายการเพิ่ม
การเปลี่ยน schema ต่อไปต้องใช้ migration ใหม่ ไม่แก้ baseline ที่แจกจ่ายแล้ว

## ฐานข้อมูลที่มีข้อมูลอยู่แล้ว

Baseline ไม่ใช่สคริปต์อัปเกรดฐานข้อมูลเก่าโดยอัตโนมัติ
สำรองทั้งฐานข้อมูลและรูปภาพ แล้วตรวจตาราง สิทธิ์ ฟังก์ชัน และ triggers ให้เทียบเท่าก่อน
รักษาข้อมูลธุรกิจ บัญชี และรหัสผ่านเดิม แก้ความขัดแย้งของ constraints ให้เรียบร้อย
จึงเปลี่ยนเฉพาะ migration ledger ให้ตรงกับ baseline อย่ารัน CREATE TABLE ทับตารางเดิม

## ตรวจติดตั้งใหม่

    npx tsx --test tests/unit/database-baseline.test.ts
    $env:POSTGRES_ADMIN_LIVE_TEST='1'
    npx tsx --test tests/integration/postgres-disbursement-migration-live.test.ts

การทดสอบ live สร้างฐานข้อมูลชั่วคราวของตัวเอง ตรวจ migration ซ้ำ RLS สิทธิ์ และ triggers
แล้วลบเฉพาะฐานข้อมูลทดสอบ ไม่รวมข้อมูลจริงในการแจกจ่าย
