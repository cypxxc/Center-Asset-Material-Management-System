# ระบบบริหารจัดการครุภัณฑ์และวัสดุส่วนกลาง (CAMMS)

Center Asset & Material Management System เป็นระบบภายในสำหรับหน่วยงานภาครัฐ ใช้จัดการทะเบียนครุภัณฑ์ บัญชีวัสดุ การเบิก–ยืม และรายงานพัสดุ

## เทคโนโลยีที่ใช้

- Next.js 16 (App Router), React 19 และ TypeScript 5
- Tailwind CSS 4 และ Radix UI
- PostgreSQL 17, Drizzle ORM และไดรเวอร์ `pg`
- Docker Compose สำหรับ PostgreSQL และ Caddy สำหรับการติดตั้ง Production แบบคอนเทนเนอร์

## สิ่งที่ต้องเตรียม

- Node.js 24.x และ npm 11.14.1 ตาม `package.json` โดย `.nvmrc` ระบุ Node.js 24.15.0
- Docker ที่เปิดใช้งานได้พร้อม Docker Compose เพื่อรัน PostgreSQL 17 ตามขั้นตอนด้านล่าง
- Git สำหรับการติดตั้งแบบ Clone

## ดาวน์โหลดและติดตั้งซอร์สโค้ด

**Git Clone**

```sh
git clone https://github.com/cypxxc/Center-Asset-Material-Management-System.git
cd Center-Asset-Material-Management-System
npm ci
```

**Download ZIP**

บน GitHub เลือกสาขาที่ต้องการ แล้วเลือก **Code → Download ZIP** แตกไฟล์และเปิดเทอร์มินัลในโฟลเดอร์ที่มี `package.json` จากนั้นรัน `npm ci` เพื่อติดตั้ง Dependencies ตาม `package-lock.json` เช่นเดียวกับการ Clone

## ฐานข้อมูลและตัวแปรสภาพแวดล้อม

สำหรับการติดตั้งใหม่ ให้รันจากโฟลเดอร์โครงการหลังเปิด Docker

```sh
# สร้างไฟล์ตั้งค่า PostgreSQL ในเครื่อง
npm run postgres:setup
# เริ่มคอนเทนเนอร์และรอให้ PostgreSQL พร้อมใช้งาน
npm run postgres:up
# เตรียมฐานข้อมูล รัน Migration และสร้าง Starter Account ในฐานข้อมูลใหม่
npm run postgres:app:setup
# สร้าง Starter User สำหรับผู้ใช้ทั่วไป (ถ้าต้องการ)
npm run postgres:user:setup
# บันทึกค่าการเชื่อมต่อของแอปลง .env.local
npm run postgres:activate
```

แต่ละคำสั่งจะแจ้งในเทอร์มินัลเมื่อทำงานสำเร็จ เมื่อ `postgres:app:setup` สร้าง **Starter Account** (บัญชีผู้ดูแลระบบ) สำเร็จ ระบบจะแจ้งอีเมล ซึ่งค่าเริ่มต้นคือ `admin@camms.local` และแสดงรหัสผ่านในเทอร์มินัลแบบโต้ตอบนอก CI หากรันผ่าน CI หรือเก็บผลลัพธ์ลงไฟล์ ให้ดูรหัสผ่านจาก `INITIAL_ADMIN_PASSWORD` ใน `.env.postgres.admin` รหัสผ่านจะถูกสุ่มหากไม่ได้กำหนดไว้ การรันซ้ำกับฐานข้อมูลที่มีบัญชีอยู่แล้วจะแจ้งว่าข้ามการสร้างบัญชี

หลังสร้าง Starter Admin แล้ว ใช้ `npm run postgres:user:setup` เพื่อสร้างบัญชี `user@camms.local` ที่มี role `user` ระบบจะสุ่มรหัสผ่านและเก็บไว้ใน `.env.postgres.user` ซึ่ง Git ไม่ติดตาม เมื่อสร้างสำเร็จ ระบบจะแสดงอีเมลและแสดงรหัสผ่านในเทอร์มินัลแบบโต้ตอบนอก CI สำหรับการรันแบบอื่น ให้ดู `INITIAL_USER_PASSWORD` ในไฟล์ดังกล่าว หากอีเมลนี้มีบัญชีอยู่แล้ว คำสั่งจะข้ามการสร้างและคงรหัสผ่านเดิม

### กู้การเชื่อมต่อ PostgreSQL เมื่อใช้ Docker volume เดิม

ให้รันทีละคำสั่งและหยุดเมื่อมีข้อผิดพลาด `postgres:up` จะทดสอบการล็อกอินจริงก่อนแจ้งว่าพร้อมใช้งาน หากเพิ่งแตก ZIP ใหม่บนเครื่องที่เคยใช้ CAMMS มาก่อน Docker อาจนำ volume เดิมกลับมาใช้ รหัสผ่านจาก `.env.postgres.local` จะถูกนำไปตั้งในฐานข้อมูลเมื่อสร้างข้อมูล PostgreSQL ครั้งแรกเท่านั้น

- ถ้ายังมีโฟลเดอร์ CAMMS เดิม ให้ใช้ `.env.postgres.local` และ `.env.postgres.app` เดิมที่ตรงกับ volume แล้วรันตั้งแต่ `npm run postgres:up` อีกครั้ง
- ถ้าไม่มีไฟล์เดิม ให้เก็บ volume ไว้และให้ผู้ดูแล PostgreSQL กู้รหัสผ่านของ `camms_local` และตรวจสิทธิ์เข้าถึงของ `camms_app` กับ `camms_auth` ให้ตรงกับไฟล์ตั้งค่าก่อนรัน `postgres:app:setup` และ `postgres:activate` สำรองไฟล์ตั้งค่าไว้ในที่ปลอดภัยสำหรับการย้ายหรืออัปเดตครั้งถัดไป

เมื่อตั้งค่าการเชื่อมต่อเอง ให้ใช้ [.env.example](.env.example) เป็นต้นแบบสำหรับ `.env.local` โดยตั้งค่าดังนี้

| ตัวแปร | การใช้งาน |
| --- | --- |
| `DATABASE_URL` | การเชื่อมต่อของแอปด้วยบทบาท `camms_app` |
| `DATABASE_AUTH_URL` | การเชื่อมต่อสำหรับบัญชีและเซสชันด้วยบทบาท `camms_auth` |
| `LOCAL_STORAGE_PATH` | โฟลเดอร์เก็บไฟล์แนบที่บัญชีซึ่งรันแอปอ่านและเขียนได้ |
| `DATABASE_MIGRATION_URL` | การเชื่อมต่อด้วยสิทธิ์เจ้าของฐานข้อมูลสำหรับ Migration ให้ตั้งในสภาพแวดล้อมของคำสั่งหรือใน `.env.postgres.app` แยกจากค่าที่แอปใช้ |

เก็บไฟล์ที่มีรหัสผ่านและข้อมูลการเชื่อมต่อไว้ในเครื่องหรือระบบจัดเก็บ Secret ของหน่วยงาน ห้ามนำขึ้น Git สำหรับฐานข้อมูลที่เตรียมไว้แล้ว ให้ตรวจสอบค่าปลายทางใน `DATABASE_MIGRATION_URL` ก่อนรัน `npm run db:migrate`

## เริ่มระบบ

**Development**

```sh
npm run verify-env
npm run dev
```

**Production**

เตรียมฐานข้อมูลให้เป็น Migration ล่าสุดและตั้งค่าการเชื่อมต่อของแอปสำหรับ Production ก่อนรัน

```sh
npm run verify-env
npm run build
npm start
```

หากใช้ Docker Compose และ Caddy สำหรับ HTTPS ให้ทำตาม [คู่มือติดตั้ง Production](docs/production/README.md)

## ตรวจสอบหลังเริ่มระบบ

ใช้ URL และพอร์ตที่เซิร์ฟเวอร์แสดง หากรันบนเครื่องที่พอร์ต 3000 ให้ตรวจสอบดังนี้

```sh
curl --fail http://localhost:3000/api/health/liveness
curl --fail http://localhost:3000/api/health/readiness
```

บน Windows PowerShell ให้ใช้ `curl.exe` ผลที่คาดหวังคือ HTTP 200 ทั้งสองคำขอ พร้อมค่า `alive: true` และ `ready: true` ตามลำดับ
