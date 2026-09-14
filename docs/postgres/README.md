# PostgreSQL บน Docker + Drizzle ORM

ระบบรองรับ PostgreSQL แยกเดี่ยวบน Docker Desktop แล้ว โดยสร้างข้อมูลใหม่ ไม่ย้ายข้อมูลหรือบัญชีจาก Supabase เว็บรันด้วย Node.js บนเครื่อง และเก็บรูปภาพในโฟลเดอร์ส่วนตัวของเซิร์ฟเวอร์

เพิ่มชุดเว็บ production บน Docker + HTTPS แล้ว ดู [คู่มือ deployment](../production/README.md), [ตั้งเวลาสำรองข้อมูล](../production/backup-README.md) และ [ผลตรวจความพร้อมล่าสุด](../release-review/README.md) ก่อนเปิดบริการจริง

## ใช้งานในเครื่องนี้

- เว็บ: http://127.0.0.1:3000
- ฐานข้อมูล: `camms_registry` ที่ `127.0.0.1:15432`
- Docker Compose project: `camms-postgres-local`
- บัญชีเริ่มต้น: `admin@camms.local` รหัสผ่านสุ่มอยู่ใน `.env.postgres.admin` เปลี่ยนผ่านหน้าโปรไฟล์หลังเข้าใช้งาน
- `.env.local` เลือก `DATA_BACKEND=postgres` และไม่มีค่า Supabase การตั้งค่าเก่าสำรองไว้ที่ `.cache/postgres/previous-env.local`
- พัสดุและข้อมูลพื้นฐานเริ่มว่าง มีเพียงบัญชีผู้ดูแลเริ่มต้นและบันทึกระบบ ข้อมูลทดสอบถูกล้างเฉพาะรายการที่สร้างสำหรับทดสอบ

## ติดตั้งใหม่

ใช้ Docker Desktop และ Node.js เวอร์ชันตาม `package.json` แล้วรันจากโฟลเดอร์โครงการ:

```sh
npm ci
npm run postgres:setup
npm run postgres:up
npm run postgres:app:setup
npm run postgres:activate
npm run dev
```

`postgres:app:setup` สร้างฐานข้อมูล ตาราง สิทธิ์ และบัญชีผู้ดูแลครั้งแรก เมื่อรันซ้ำจะใช้ข้อมูลเดิมและใช้ migration ที่ยังไม่เคยรันเท่านั้น ไม่ล้างข้อมูลหรือรีเซ็ตรหัสผ่าน กำหนด `INITIAL_ADMIN_EMAIL` และ `INITIAL_ADMIN_PASSWORD` ก่อนติดตั้งครั้งแรกได้ หากไม่กำหนดจะสร้างรหัสผ่านสุ่ม

`postgres:activate` เปลี่ยน `.env.local` และสำรองค่าเดิมก่อน ต้องเริ่มเว็บใหม่เมื่อเปลี่ยนค่า พอร์ตคอนเทนเนอร์คือ 5432 เปิดผ่าน loopback ของเครื่องที่ 15432 หากพอร์ตถูกใช้ให้เปลี่ยน `POSTGRES_PORT` ก่อนติดตั้ง Windows เครื่องนี้จองพอร์ต 55432 ไว้จึงใช้ 15432

## ไฟล์และสิทธิ์

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `.env.postgres.local` | บัญชีเจ้าของ PostgreSQL สำหรับ Docker และการติดตั้ง |
| `.env.postgres.app` | ค่า migration และบัญชีจำกัดสิทธิ์ของแอป |
| `.env.local` | ค่าที่เว็บต้องใช้ ไม่มีบัญชีเจ้าของฐานข้อมูล |
| `.env.postgres.admin` | บัญชีผู้ดูแลเริ่มต้น |
| `.local-storage/` | รูปภาพส่วนตัว อ่านผ่าน endpoint ที่ตรวจสิทธิ์ |
| Docker volume `camms-postgres-local_postgres_data` | ข้อมูล PostgreSQL ถาวร |

ไฟล์รหัสผ่าน รูปภาพ และ backup ถูก Git ignore แล้ว อย่าเผยแพร่ไฟล์เหล่านี้ บัญชี `camms_app` ไม่ใช่ superuser และไม่ข้าม RLS ส่วน `camms_auth` เข้าถึงเฉพาะบัญชีและเซสชัน การจัดการผู้ใช้ตรวจสิทธิ์ผู้ดูแลก่อนเข้าถึงส่วนนี้

ผู้ดูแลและเจ้าหน้าที่จัดการพัสดุและข้อมูลพื้นฐานได้ ผู้ดูข้อมูลอ่านข้อมูลที่เปิดใช้งานได้ ส่วนจัดการบัญชี/ฐานข้อมูล/สำรองข้อมูลจำกัดเฉพาะผู้ดูแล การลบข้อมูลพื้นฐานที่ถูกพัสดุใช้อยู่จะถูกปฏิเสธ

## Drizzle และ migration

Schema อยู่ที่ `db/postgres/schema.ts` และ migration อยู่ใน `db/postgres/migrations/` แยกจาก Supabase เดิม:

```sh
npm run db:generate
# ตรวจ SQL ก่อนนำไปใช้
npm run db:migrate
```

RLS, grants, audit triggers และ identity helpers เป็น SQL migrations แยกไว้ ห้ามใช้ schema push แทนกระบวนการนี้บนฐานข้อมูลใช้งานจริง เซสชันใช้ opaque token ใน HttpOnly cookie เก็บเฉพาะ hash ในฐานข้อมูล รหัสผ่านใช้ scrypt และจำกัดการลองล็อกอินใน PostgreSQL โดยไม่พึ่ง forwarded IP เพียงอย่างเดียว

## สำรองและกู้คืน

หน้าแผงฐานข้อมูลส่งออก JSON สำหรับข้อมูลธุรกิจได้ การนำเข้าจะแทนที่พัสดุ หมวดหมู่ สถานที่ และหน่วยนับแบบ transaction โดยเก็บบัญชีและประวัติเดิมไว้ หากข้อมูลผิดจะย้อนกลับทั้งหมด JSON นี้ไม่รวมรหัสผ่านและรูปภาพ Raw SQL console ปิดในโหมด PostgreSQL

สำรองทั้งระบบ รวม schema, บัญชี/password hashes, เซสชัน, ประวัติ และรูปภาพ:

```powershell
npm run backup:release -- 'D:/CAMMS-Backups'
```

คำสั่งสร้างโฟลเดอร์ใหม่พร้อม `database.dump`, `storage/` และ `manifest.json` จะล็อกการเขียนชั่วคราวระหว่างสำรอง เพื่อให้ไฟล์ตรงกับข้อมูลที่อ้างอิง โฟลเดอร์ที่ไม่มี manifest ถือว่ายังสำรองไม่สำเร็จ เก็บ backup นี้เป็นข้อมูลลับ

การกู้คืนทั้งระบบใช้ `pg_restore` ไปยังฐานข้อมูลใหม่ที่เตรียม roles `camms_app`/`camms_auth` แล้ว คืนโฟลเดอร์ storage ไปยังตำแหน่งใหม่ ล้าง `private_auth.sessions` ก่อนเปิดเว็บ และปรับค่าการเชื่อมต่อกับ `LOCAL_STORAGE_PATH` ให้ตรงกับชุดที่กู้คืน อย่าใช้ UI JSON restore แทนการกู้คืนทั้งระบบ

หยุด/เปิดฐานข้อมูลโดยเก็บ volume เดิม:

```sh
npm run postgres:stop
npm run postgres:up
```

## ตรวจสอบ

```sh
npm run typecheck
npm run check
npm run verify-db-release
npm run postgres:verify:security
npm run postgres:verify:browser
```

การตรวจผ่านเว็บต้องเปิดเว็บโหมด PostgreSQL ไว้ที่ `127.0.0.1:3000` และใช้บัญชีเริ่มต้นใน `.env.postgres.admin` หากเปลี่ยนรหัสผ่านแล้ว ต้องปรับข้อมูลทดสอบให้ตรงก่อนรัน การทดสอบสร้างรายการชื่อ UUID ของตัวเองและล้างเฉพาะรายการนั้น

ตรวจฐานข้อมูลจริงเพิ่มเติมบน PowerShell:

```powershell
$env:POSTGRES_QUERY_INTEGRATION='1'
node --import tsx --test features/items/postgres-queries-live.test.ts
$env:POSTGRES_ADMIN_LIVE_TEST='1'
node --import tsx --test tests/integration/postgres-admin-live.test.ts tests/integration/postgres-admin-restore-live.test.ts
$env:POSTGRES_HTTP_INTEGRATION='1'
npm run postgres:verify:http
```

การทดสอบ query/admin ย้อนกลับ fixture ทั้งหมด ส่วน restore สร้างฐานข้อมูลชั่วคราวแยก ทดสอบติดตั้งซ้ำ/กู้คืนสำเร็จ/กู้คืนผิดพลาด แล้วลบเฉพาะฐานข้อมูลชั่วคราวนั้น

โหมดนี้ใช้เซิร์ฟเวอร์ Node.js ที่ทำงานต่อเนื่องและพื้นที่เก็บไฟล์ถาวร หากใช้หลายเซิร์ฟเวอร์หรือ serverless ต้องเตรียมที่เก็บไฟล์ร่วมและระบบกระจายเหตุการณ์ให้เหมาะสมก่อน

## ผลตรวจล่าสุด — 14 กันยายน 2026

- ชุดทดสอบปกติผ่าน 449 ข้อใน 108 ไฟล์ ณ รอบตรวจหลัก; การทดสอบฐานข้อมูลจริงที่ต้องเปิดใช้แยกรันและผ่านแล้ว
- Typecheck, lint, production build และงบขนาด JavaScript ผ่าน
- Dependency audit ทั้งหมดไม่พบช่องโหว่ที่รายงาน
- หน้าเว็บโหมด production: ล็อกอิน, หน้าหลักทั้ง 9 หน้า, สร้างหน่วยนับ/พัสดุ, แก้ไขและตรวจค่าที่บันทึกจริง, ออกจากระบบ ผ่านโดยไม่เรียก Supabase
- ฐานข้อมูลจริง: RLS, สิทธิ์ผู้ใช้, ป้องกันการยกระดับสิทธิ์, เซสชันหมดอายุ/ถูกยกเลิก, และการล็อกอินพร้อมรีเซ็ตรหัสผ่าน ผ่าน
- ฐานข้อมูลชั่วคราว: ติดตั้ง migration ซ้ำได้; กู้คืนสำเร็จและกู้คืนผิดพลาดแบบย้อนกลับทั้งหมด ผ่าน
- HTTP รูปภาพส่วนตัวและ SSE: ผู้ไม่มีสิทธิ์ถูกปฏิเสธ, commit ส่งเหตุการณ์, rollback ไม่ส่ง, เซสชันถูกยกเลิกปิด stream ภายในรอบตรวจ 15 วินาที
- สร้าง full backup และตรวจว่า PostgreSQL อ่าน archive ซึ่งมีข้อมูลธุรกิจ บัญชี ประวัติ และ migration ได้
- หลังล้าง fixture: ผู้ใช้ 1 บัญชี, พัสดุ/หมวดหมู่/สถานที่/หน่วยนับ 0 รายการ

## MCP ในโหมด PostgreSQL

ระบุ UUID ของบัญชีที่อนุญาตให้เครื่องมือใช้ โดยดูได้จากหน้าจัดการฐานข้อมูล ตาราง profiles:

```powershell
$env:MCP_POSTGRES_PROFILE_ID='<UUID ของบัญชีที่เปิดใช้งาน>'
npm run mcp
```

ค่าเริ่มต้นอ่านอย่างเดียว หากต้องการให้เขียน ให้กำหนด `CAMMS_MCP_ALLOW_WRITE=true` เพิ่ม และบัญชีที่เลือกต้องเป็นเจ้าหน้าที่หรือผู้ดูแล การแก้ไขถูกตรวจ RLS และบันทึก audit ใช้เฉพาะบัญชีฐานข้อมูล `camms_app` ไม่เลือกตัวตนผู้ดูแลให้อัตโนมัติ การทดสอบเครื่องมือนี้ผ่านทั้ง stdio จริงและ CRUD/สิทธิ์บนฐานข้อมูลชั่วคราวแยก
