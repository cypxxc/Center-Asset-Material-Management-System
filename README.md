# CAMMS Portal — Center Asset & Material Management System
### ระบบบริหารจัดการทรัพย์สินและวัสดุส่วนกลาง

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker)](https://www.docker.com/)

---

## 📌 ภาพรวมระบบ (System Overview)

**CAMMS (Center Asset & Material Management System)** คือระบบสารสนเทศเว็บแอปพลิเคชันสำหรับหน่วยงานภาครัฐและองค์กร เพื่อใช้บริหาร จัดการ ติดตาม และตรวจสอบพัสดุส่วนกลางตามระเบียบงานพัสดุและมาตรฐานกรมบัญชีกลาง โดยแบ่งการทำงานออกเป็น 2 ประเภทหลัก:

1. **ครุภัณฑ์ (Durable Assets):** ทรัพย์สินคงทนถาวร ติดตามรายชิ้นด้วยรหัสครุภัณฑ์, หมายเลขซีเรียล (Serial Number), อาคาร/สถานที่จัดเก็บ, ผู้ถือครอง, ระบบพิมพ์ฉลาก QR Code (รองรับกระดาษ A4 และ Thermal Roll) และคำนวณค่าเสื่อมราคาแบบเส้นตรง (Straight-line Depreciation) สูงสุดจนเหลือมูลค่า 1 บาท
2. **วัสดุสิ้นเปลือง (Consumable Materials):** พัสดุสิ้นเปลือง ติดตามยอดรับ-จ่ายตามบัญชีคุมวัสดุราชการ ยอดคงเหลือ แจ้งเตือนจุดสั่งซื้อขั้นต่ำ และตัดสต็อกทันทีเมื่อส่งคำขอเบิก

### ✨ ฟังก์ชันสำคัญ (Key Features)

- **ทะเบียนทรัพย์สินและวัสดุ (Registry & Inventory):** จัดการข้อมูล เพิ่ม ปรับปรุง จำหน่าย พร้อมรองรับ 13 หมวดหมู่ครุภัณฑ์มาตรฐานสำนักงบประมาณ
- **สร้างและพิมพ์ฉลาก QR Code (Asset Tags & Labels):** สร้าง QR Code และพิมพ์ป้ายติดครุภัณฑ์ทันที รองรับทั้งเครื่องพิมพ์สติกเกอร์ทั่วไปและ Thermal Roll
- **ระบบเบิกจ่ายและยืม-คืน (Disbursements & Loans):** คำขอเบิกจ่ายวัสดุ ทะเบียนคุมการยืม-คืนครุภัณฑ์ พร้อมระบบตัดและคืนยอดคงเหลือแบบอัตโนมัติ
- **คำนวณค่าเสื่อมราคา (Depreciation Tracking):** คำนวณมูลค่าทางบัญชีและค่าเสื่อมราคาสะสมอัตโนมัติตามระยะเวลาถือครอง
- **รายงานและการส่งออก (Reports & Export):** สร้างรายงานสรุปยอดพัสดุและส่งออกไฟล์ **Excel (.xlsx)** และ **PDF**
- **ระบบกำหนดสิทธิ์ผู้ใช้งาน (RBAC & Security):**
  - `admin` (ผู้ดูแลระบบ): สิทธิ์ระดับสูงสุดในการจัดการระบบ (Full CRUD) ทั้งครุภัณฑ์ วัสดุ หมวดหมู่ สถานที่ หน่วยนับ การอนุมัติ/ยืนยันการเบิกจ่ายและยืม-คืน จัดการบัญชีผู้ใช้ รีเซ็ตรหัสผ่าน ตรวจสอบ Audit Logs พร้อมระบบป้องกันตนเอง (Anti-Lockout) ไม่ให้ลบหรือลดสิทธิ์ผู้ดูแลคนสุดท้าย
  - `user` (ผู้ใช้งานทั่วไป): สิทธิ์เข้าดูข้อมูลครุภัณฑ์ วัสดุ และรายงาน (Read-only) สามารถสร้างและส่งคำขอเบิกวัสดุ (`material_issue`) ได้ แต่ไม่สามารถแก้ไขทะเบียนทรัพย์สิน อนุมัติรายการ หรือเข้าถึงส่วนการตั้งค่าระบบและจัดการผู้ใช้
- **มาตรฐานภาษาไทย (Thai-first UI):** แสดงผลด้วยฟอนต์ *Sarabun* เรียงลำดับคำภาษาไทยตามพจนานุกรมด้วย ICU Collation (`th-TH-x-icu`) และจัดเก็บข้อความด้วย Unicode NFC Normalization

---

## 🛠️ Technology Stack ที่ใช้งานจริง

| เลเยอร์ (Layer) | เทคโนโลยีที่ใช้ (Technology) | รายละเอียด (Specification) |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, Standalone Output, Webpack Build, Node.js 24 LTS |
| **Frontend & UI** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) | Radix UI Primitives, Lucide Icons, Thai Sarabun Font |
| **Database & ORM** | [PostgreSQL 17](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) | Row-Level Security (RLS), Connection Pooling, ICU Collation |
| **Authentication** | Custom PostgreSQL Auth | จัดการใน `private_auth` schema ด้วย Bcrypt และ SHA-256 Tokens |
| **Reverse Proxy** | [Caddy](https://caddyserver.com/) | Reverse Proxy พร้อมระบบจัดการ HTTPS/TLS Certificate อัตโนมัติ |
| **File Storage** | Authenticated Local Storage | จัดเก็บรูปภาพ/เอกสารลง Storage บนเซิร์ฟเวอร์พร้อมจำกัดสิทธิ์อ่าน |
| **Export Engines** | [ExcelJS](https://github.com/exceljs/exceljs) | สรุปรายงานและส่งออก Spreadsheet (.xlsx) และ Browser Print PDF |

---

## 💻 Requirements สำหรับติดตั้ง

- **ระบบปฏิบัติการ (OS):** Linux (แนะนำ Ubuntu 22.04 LTS ขึ้นไปสำหรับ Production) หรือ Windows Server / Windows ที่มี Docker
- **Docker & Docker Compose:** Docker Engine 24+ และ Docker Compose v2+
- **Node.js & npm:** Node.js `>=24.0.0 <25` (LTS) และ npm `11.14.1` (จำเป็นสำหรับรันสคริปต์ Setup และ Migration)
- **เครือข่ายและพอร์ต (Network Ports):**
  - พอร์ต `80` (HTTP) และ `443` (HTTPS) สำหรับเว็บผ่าน Caddy Proxy (หรือพอร์ตอื่นตามที่กำหนด)
  - พอร์ต `15432` สำหรับ PostgreSQL Local Container (เข้าถึงได้เฉพาะ Localhost หรือ Docker Network ภายใน)
- **พื้นที่จัดเก็บข้อมูล (Storage):** โฟลเดอร์สำหรับเก็บไฟล์อัปโหลด (Persistent Local Storage) และ Volume สำหรับ Database

---

## 🚀 ขั้นตอนติดตั้งแบบย่อ (Production Deployment Guide)

### ขั้นตอนที่ 1: Clone Repository และติดตั้ง Dependencies

```bash
git clone <repository-url>
cd Center-Asset-Material-Management-System
npm ci
```

### ขั้นตอนที่ 2: เตรียมฐานข้อมูลและการรัน Migration

ระบบมีสคริปต์อัตโนมัติสำหรับสร้างคอนฟิกและฐานข้อมูล:

```bash
# 1. สร้างคอนฟิกฐานข้อมูลและรหัสผ่านแบบสุ่ม (.env.postgres.local)
npm run postgres:setup

# 2. เริ่มการทำงานของ PostgreSQL Container บน Docker
npm run postgres:up

# 3. รัน Database Migrations และสร้างบัญชี Admin เริ่มต้น
npm run postgres:app:setup
```

> 🔐 **การกำหนดบัญชีผู้ดูแลระบบ (Admin Account):**
> - **สำหรับ Production:** แนะนำให้กำหนดอีเมลและรหัสผ่านที่ปลอดภัยผ่าน Environment Variables ก่อนรันคำสั่ง setup:
>   ```bash
>   INITIAL_ADMIN_EMAIL="admin@yourdomain.go.th" INITIAL_ADMIN_PASSWORD="<STRONG_PASSWORD>" npm run postgres:app:setup
>   ```
> - **กรณีไม่ระบุ:** ระบบจะสุ่มรหัสผ่านและสร้างบัญชีเริ่มต้นไว้ในไฟล์ `.env.postgres.admin` (อีเมลเริ่มต้น: `admin@camms.local`) ให้เปิดดูเพื่อเข้าสู่ระบบครั้งแรกและ**ต้องเปลี่ยนรหัสผ่านทันที**ผ่านหน้า Profile
> - ⚠️ **ข้อควรระวัง:** ห้ามใช้รหัสผ่านสุ่มเริ่มต้นหรืออีเมลตัวอย่างสำหรับการพัฒนาต่อเนื่องใน Production

> ℹ️ *หมายเหตุ:* คำสั่ง `npm run postgres:activate` มีไว้สำหรับการรันแบบ Local Development บนเครื่องพัฒนาเท่านั้น **ห้ามนำมาใช้ใน Production** (ใน Production ให้ใช้ไฟล์ `.env.production.compose` และ `.env.production.runtime` ในขั้นตอนถัดไป)

### ขั้นตอนที่ 3: กำหนดค่า Production Endpoint

ใช้สคริปต์ `scripts/prepare-production.ts` เพื่อสร้างไฟล์ `.env.production.compose` และ `.env.production.runtime` โดยอัตโนมัติ:

**กรณีที่ 1: ใช้งาน Production จริงด้วย Public Domain (HTTPS อัตโนมัติ):**
```bash
npx tsx scripts/prepare-production.ts --site asset.yourdomain.go.th --tls public --bind 0.0.0.0
```

**กรณีที่ 2: ทดสอบระบบภายในหรือบนเครื่อง Localhost (Internal TLS):**
```bash
npx tsx scripts/prepare-production.ts --site localhost --tls internal --https-port 8443 --http-port 8080
```

### ขั้นตอนที่ 4: Build และเริ่มระบบด้วย Docker Compose

```bash
# 1. Build Docker Image (Standalone Next.js)
docker compose --env-file .env.production.compose -f compose.production.yaml build

# 2. เริ่มการทำงานของบริการทั้งหมดในโหมด Background
docker compose --env-file .env.production.compose -f compose.production.yaml up -d --wait --wait-timeout 120

# 3. ตรวจสอบสถานะ Containers
docker compose --env-file .env.production.compose -f compose.production.yaml ps
```

---

## ⚙️ Environment Variables สำคัญ

ระบบแยกตัวแปรการเชื่อมต่อตามหลัก Least Privilege โดยไม่มีการเปิดเผยรหัสผ่านในคู่มือ:

| ตัวแปร (Variable) | หน้าที่และความสำคัญ | แหล่งที่มา / ตำแหน่งที่เก็บ |
| :--- | :--- | :--- |
| `DATABASE_URL` | การเชื่อมต่อสำหรับ Application ทั่วไป (`camms_app` role) บังคับใช้ RLS | `.env.production.runtime` / `.env.postgres.app` |
| `DATABASE_AUTH_URL` | การเชื่อมต่อสำหรับตรวจสอบบัญชีและเซสชัน (`camms_auth` role) | `.env.production.runtime` / `.env.postgres.app` |
| `DATABASE_MIGRATION_URL`| การเชื่อมต่อระดับ Migration/Owner สำหรับอัปเดตสคีมา | `.env.postgres.app` |
| `LOCAL_STORAGE_PATH` | Path ไดเรกทอรีสำหรับเก็บไฟล์รูปภาพและเอกสารแนบบนเครื่อง Host | `.env.production.compose` (Bind mount ไปยัง `/data/storage`) |
| `CAMMS_SITE` | ชื่อ Hostname หรือ Domain สำหรับออกใบรับรอง TLS | `.env.production.compose` |
| `CAMMS_BIND_ADDRESS` | ที่อยู่ IP สำหรับ Bind บริการเว็บ (เช่น `0.0.0.0` หรือ `127.0.0.1`) | `.env.production.compose` |
| `CAMMS_HTTP_PORT` / `CAMMS_HTTPS_PORT` | พอร์ตสำหรับ Caddy Proxy (ค่าเริ่มต้น: 80 / 443) | `.env.production.compose` |
| `GEMINI_API_KEY` | *(ทางเลือก)* API Key สำหรับระบบ AI UAT และการตรวจสอบข้อมูล | `.env.local` |

> ⚠️ ดูรูปแบบตัวอย่างโครงสร้างตัวแปรได้ที่ไฟล์ [`.env.example`](.env.example)

---

## 🔄 วิธีเริ่ม/หยุดระบบ และการตรวจสอบ Health Check

### คำสั่งควบคุมระบบ (Docker Production)

```bash
# ตรวจสอบสถานะ Containers และ Healthcheck
docker compose --env-file .env.production.compose -f compose.production.yaml ps

# ดู Logs การทำงานแบบ Realtime
docker compose --env-file .env.production.compose -f compose.production.yaml logs -f app

# รีสตาร์ทเฉพาะ App และ Proxy
docker compose --env-file .env.production.compose -f compose.production.yaml restart app proxy

# หยุดการทำงานของระบบ
docker compose --env-file .env.production.compose -f compose.production.yaml stop

# เริ่มระบบกลับขึ้นมาใหม่
docker compose --env-file .env.production.compose -f compose.production.yaml up -d
```

### การตรวจสอบ Health Check

ระบบมี HTTP Endpoints สำหรับตรวจเช็คสถานะการทำงาน:

```bash
# 1. Readiness Probe (ตรวจสอบความพร้อมของ Database, Storage และระบบทั้งหมด)
curl -k https://<your-host>:<port>/api/health/readiness
# คืนค่า: {"ready":true,"checks":{"database":{"status":"up"},"storage":{"status":"up"},"authDatabase":{"status":"up"}}}

# 2. Liveness Probe (ตรวจสอบว่า Web Process ยังคงทำงานปกติ)
curl -k https://<your-host>:<port>/api/health/liveness
# คืนค่า: {"alive":true}
```

---

## 💾 การ Backup และ Restore เบื้องต้น

### 1. การทำ Full Backup (Database + Files)

ระบบมีสคริปต์รวมสำหรับสำรองข้อมูล PostgreSQL (แบบ Custom Dump) พร้อมไฟล์แนบทั้งหมดในโฟลเดอร์ Storage:

```bash
# รัน Backup ไปยัง Absolute Directory ภายนอก (ระบุ Path เต็ม)
npm run backup:release -- "/var/backups/camms"
# (บน Windows: npm run backup:release -- "D:/CAMMS-Backups")
```

เมื่อเสร็จสมบูรณ์ จะได้โฟลเดอร์ชื่อ `camms-postgres-<timestamp>-<uuid>` ซึ่งประกอบด้วย:
- `database.dump`: ข้อมูลฐานข้อมูล PostgreSQL
- `storage/`: ไฟล์เอกสารและรูปภาพทั้งหมด
- `manifest.json`: รายการไฟล์และ Checksum (SHA-256) เพื่อยืนยันความถูกต้อง

### 2. การตั้งค่า Scheduled Backup
สำหรับการสำรองข้อมูลอัตโนมัติตามตารางเวลา สามารถดูวิธีการตั้งค่า Windows Task Scheduler หรือ Cron Job ได้ที่คู่มือ [docs/production/backup-README.md](docs/production/backup-README.md)

### 3. การ Restore ข้อมูลเบื้องต้น
1. กู้คืนโครงสร้างและข้อมูลฐานข้อมูลผ่านคำสั่ง `pg_restore`:
   ```bash
   pg_restore -U <db_user> -d camms_registry --clean --if-exists database.dump
   ```
2. คัดลอกโฟลเดอร์ `storage/` จากชุดสำรองข้อมูลกลับไปยังตำแหน่ง `LOCAL_STORAGE_PATH`
3. ล้างเซสชันเก่าในตาราง `private_auth.sessions` ก่อนเปิดให้บริการอีกครั้ง
> 📖 ศึกษารายละเอียดเพิ่มเติมได้ที่ [docs/postgres/README.md](docs/postgres/README.md)

---

## ⚠️ ข้อควรระวังในการติดตั้ง Production

1. **ไม่ใช้ Development Credentials ใน Production:**
   - ห้ามใช้บัญชีและรหัสผ่านเริ่มต้นสำหรับการพัฒนา (`admin@camms.local`) ในสภาพแวดล้อม Production
   - ห้ามคัดลอกไฟล์คอนฟิก Development (เช่น `.env.local` จาก `npm run postgres:activate`) ไปใช้กับ Production
   - กำหนดสิทธิ์ไฟล์คอนฟิกและ Secrets เช่น `.env.production.runtime`, `.env.postgres.app`, `.env.postgres.admin` ให้เข้มงวด (เช่น `chmod 600`) และห้าม commit ขึ้น Version Control เด็ดขาด
2. **เปลี่ยนรหัสผ่าน Admin เริ่มต้นทันที:**
   - หากติดตั้งโดยใช้รหัสผ่านสุ่มใน `.env.postgres.admin` ให้เข้าสู่ระบบและเปลี่ยนรหัสผ่านใหม่ทันทีผ่านหน้า Profile
3. **การแยกสิทธิ์ Database Roles:**
   - ห้ามใช้ Superuser (`postgres`) เป็น Connection String ของ Application Runtime โดยเด็ดขาด ให้ใช้ `camms_app` สำหรับงานทั่วไป (ซึ่งถูกจำกัดด้วย RLS และไม่สามารถเข้าถึงตารางจัดเก็บรหัสผ่านได้) และ `camms_auth` สำหรับระบบตรวจสอบเซสชัน/ล็อกอิน
4. **ความคงอยู่ของข้อมูล (Persistent Storage):**
   - ตรวจสอบว่า Docker Volume `postgres_data` และโฟลเดอร์ `LOCAL_STORAGE_PATH` ตั้งอยู่บน Storage ที่มีความทนทาน มีระบบสำรองข้อมูลสม่ำเสมอ และไม่ถูกลบเมื่อรีสตาร์ทเซิร์ฟเวอร์
5. **Anti-Lockout Protection:**
   - ระบบมีกลไกป้องกันการลบหรือลดสิทธิ์ผู้ดูแลระบบคนสุดท้าย เพื่อป้องกันปัญหาไม่มีสิทธิ์จัดการระบบ

---

## 📜 คำสั่ง CLI ที่สำคัญ (CLI Reference)

| คำสั่ง (Command) | คำอธิบาย (Description) |
| :--- | :--- |
| `npm run postgres:setup` | สร้างไฟล์กำหนดค่าฐานข้อมูลเริ่มต้น (`.env.postgres.local`) |
| `npm run postgres:up` | เริ่มการทำงานของ Docker PostgreSQL Container |
| `npm run postgres:stop` | หยุดการทำงานของ Docker PostgreSQL Container (เก็บข้อมูลใน Volume ถาวร) |
| `npm run postgres:app:setup` | ดำเนินการ Migrate สคีมา และสร้างบัญชี Admin เริ่มต้น |
| `npm run postgres:activate` | สลับค่า `.env.local` มาใช้งาน Local Docker PostgreSQL สำหรับ Development |
| `npm run verify-env` | ตรวจสอบความถูกต้องของ Environment Variables ก่อนเริ่มแอปพลิเคชัน |
| `npm run backup:release -- <path>` | ดำเนินการ Full Backup ฐานข้อมูลและ Storage ไปยังไดเรกทอรีที่ระบุ |
| `npm run health:diagnose` | ตรวจสอบความผิดปกติของข้อมูลใน Database และ Storage |
| `npm run health:heal` | สั่งซ่อมแซมและแก้ไขข้อมูลที่ผิดปกติโดยอัตโนมัติ |

---

## 📚 เอกสารอ้างอิงเพิ่มเติม (Documentation)

- [Docker PostgreSQL & Schema Guide](docs/postgres/README.md) — คู่มือรายละเอียดฐานข้อมูลและ Migrations
- [Scheduled Backup Policy Guide](docs/production/backup-README.md) — นโยบายและการตั้งค่าการสำรองข้อมูลอัตโนมัติ
- [System Architecture](docs/ARCHITECTURE.md) — สถาปัตยกรรมระบบและ Network Flow
- [Database Schema Documentation](docs/DATABASE_SCHEMA.md) — รายละเอียดโครงสร้างตารางและสิทธิ์ RLS
- [Business Rules & Workflows](docs/BUSINESS_RULES.md) — กฎทางธุรกิจ บัญชีคุมวัสดุ และการตัดสต็อก
- [Developer & Agent Guidelines](AGENTS.md) — แนวทางการพัฒนาและการบำรุงรักษาโค้ด

---

## 📄 ใบอนุญาต (License)

CAMMS Portal จัดทำขึ้นเพื่อใช้งานภายในหน่วยงาน (Internal Use Only)
