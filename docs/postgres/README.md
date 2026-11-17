# PostgreSQL 17 + Drizzle

ระบบใช้ PostgreSQL บน Docker และเก็บรูปภาพในพื้นที่ส่วนตัวของเซิร์ฟเวอร์
ดู [ขั้นตอนติดตั้งใหม่](../../AGENT_SETUP.md)

## Schema และ migration

- Model: db/postgres/schema.ts
- Baseline: db/postgres/migrations/0000_final_schema.sql
- Metadata: meta/_journal.json และ meta/0000_snapshot.json

Baseline รวม 15 ตาราง พร้อม constraints, indexes, RLS, grants, functions และ triggers
บัญชีไม่มีอีเมลเก็บ NULL ได้ ไฟล์ SQL ไม่มีข้อมูลบัญชีหรือพัสดุของผู้พัฒนา
ดู [รายละเอียด baseline](final-schema.md)

## เริ่มใช้งาน

    npm ci
    npm run postgres:setup
    npm run postgres:up
    npm run postgres:app:setup
    npm run postgres:activate
    npm run verify-env
    npm run dev

เว็บอยู่ที่ http://127.0.0.1:3000 บัญชีผู้ดูแลเริ่มต้นอยู่ใน .env.postgres.admin
PostgreSQL ใช้พอร์ตเริ่มต้น 15432 ข้อมูลเก็บใน Docker volume
camms_app ใช้ RLS และไม่มีสิทธิ์ superuser หรือข้าม RLS
camms_auth ใช้เฉพาะงานบัญชีและเซสชัน

## พัฒนา schema ต่อไป

    npm run db:generate
    npm run db:migrate

ตรวจ SQL และสำรองก่อนใช้งานกับฐานข้อมูลที่มีข้อมูล
ใช้ migration ใหม่ต่อจาก baseline ไม่ใช้ schema push แทน
หากแก้ RLS, grants, functions หรือ triggers ต้องรวม SQL ส่วนนั้นด้วย
ฐานข้อมูลเก่าต้องสำรองและตรวจความเทียบเท่า schema ก่อนเปลี่ยน ledger

## สำรองและกู้คืน

    npm run backup:release -- 'D:/CAMMS-Backups'

Full backup มี database.dump, storage/ และ manifest.json
เก็บเป็นความลับเพราะรวมข้อมูลบัญชีและ password hashes
กู้คืนด้วย pg_restore ลงฐานข้อมูลใหม่ที่เตรียม roles ไว้ แล้วตั้งค่าที่เก็บรูปภาพให้ตรงกัน
ล้างเซสชันในชุดที่กู้คืนก่อนเปิดให้ใช้งาน
JSON export ในหน้าแอดมินเป็นข้อมูลธุรกิจ ไม่ใช่ full backup
ดู [การสำรองตามเวลา](../production/backup-README.md)

หยุดหรือเปิด PostgreSQL โดยเก็บข้อมูลเดิม:

    npm run postgres:stop
    npm run postgres:up

## MCP

ตั้ง MCP_POSTGRES_PROFILE_ID เป็น UUID ของบัญชีที่อนุญาต แล้วรัน npm run mcp
ค่าเริ่มต้นอ่านอย่างเดียว การเขียนต้องเปิด CAMMS_MCP_ALLOW_WRITE=true และมีสิทธิ์ที่เหมาะสม
