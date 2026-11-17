# CAMMS — Project Context

CAMMS เป็นเว็บภาษาไทยสำหรับบริหารครุภัณฑ์ พัสดุ และคำขอเบิก–จ่าย
ใช้ Next.js 16 App Router, React 19, Tailwind CSS v4, PostgreSQL 17 และ Drizzle ORM
บัญชีและเซสชันอยู่ใน private_auth โดยใช้การเชื่อมต่อฐานข้อมูลที่แยกสิทธิ์

## การเริ่มงาน

อ่าน PRODUCT.md, README.md และ AGENTS.md ในโฟลเดอร์นี้ตามลำดับ
ก่อนเขียนโค้ด Next.js ให้อ่านคู่มือรุ่นที่ติดตั้งใน node_modules/next/dist/docs/

ดู [วิธีติดตั้ง](../../AGENT_SETUP.md) สำหรับเครื่องใหม่ ต้องใช้ Node.js 24.x และ Docker Desktop

## โครงสร้าง

- app/: routes, layouts และหน้าเว็บ
- components/: UI และ layout ที่ใช้ร่วมกัน
- features/: queries, Server Actions, schema และ components ของแต่ละส่วน
- lib/: ฐานข้อมูล เซสชัน validation และ utilities
- db/postgres/schema.ts: Drizzle models
- db/postgres/migrations/: baseline และ metadata สำหรับติดตั้ง
- scripts/: setup, backup และ verification
- tests/: unit, component และ integration tests

## ฐานข้อมูลและ migration

Baseline คือ [0000_final_schema.sql](../../db/postgres/migrations/0000_final_schema.sql)
ต้องมี meta/_journal.json และ meta/0000_snapshot.json อยู่ด้วย
Drizzle บันทึกการติดตั้งใน drizzle.__drizzle_migrations
ดู [รายละเอียด baseline](../postgres/final-schema.md) และ [คู่มือ PostgreSQL](../postgres/README.md)

การแก้ schema ต่อไปสร้าง migration ใหม่ ไม่แก้ baseline ที่แจกจ่ายแล้ว:

    npm run db:generate
    npm run db:migrate

## รูปแบบโค้ด

- Server Components อ่านข้อมูลผ่าน features/<domain>/queries.ts
- การเปลี่ยนข้อมูลใช้ Server Actions ใน features/<domain>/actions.ts
- คำขอทั่วไปใช้ withUserDatabase() เพื่อบังคับ RLS ตามผู้ใช้
- การเชื่อมต่อ auth จำกัดสำหรับงานบัญชีและเซสชัน
- ใช้ parameterized SQL และตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์
- การแก้ข้อมูลส่วนกลางต้อง invalidate cache และ sidebar ที่เกี่ยวข้อง
- ใช้ semantic CSS tokens และรองรับภาษาไทย
- รักษา permissions, สูตรค่าเสื่อมราคา และ audit behavior เดิม

## คำสั่งตรวจสอบ

    npm run verify-env
    npm test
    npm run lint
    npm run typecheck
    npm run build

Integration tests ที่แตะฐานข้อมูลต้องเปิดใช้แยกและใช้ fixture ที่ปลอดภัย
ผลการรันและหลักฐานชั่วคราวอยู่ใน .cache/ หรือ test-results/ ไม่ใช่คู่มือใช้งาน

## Health endpoints

- GET /api/health/readiness
- GET /api/health/liveness
- GET /api/health/status
