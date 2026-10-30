# CAMMS Portal — Center Asset & Material Management System
### ระบบบริหารจัดการทรัพย์สินและวัสดุส่วนกลาง

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Supported-3ECF8E?logo=supabase)](https://supabase.com/)

[English](#english-overview) • [ภาษาไทย](#ภาพรวมระบบภาษาไทย) • [คู่มือการรันด้วย Docker](#-การรันระบบด้วย-docker-docker-execution-guide)

---

## ภาพรวมระบบ (ภาษาไทย)

**CAMMS (Center Asset & Material Management System)** คือเว็บแอปพลิเคชันภายในสำหรับหน่วยงานและองค์กร ใช้จัดการ ติดตาม และตรวจสอบครุภัณฑ์และวัสดุส่วนกลาง พัฒนาด้วย **Next.js 16 (App Router)** รองรับทั้งฐานข้อมูล **Supabase** และ **Standalone Docker PostgreSQL** พร้อมสถาปัตยกรรมความปลอดภัยระดับสูง การจัดกลุ่มบทบาทผู้ใช้งาน (RBAC) และการออกแบบที่เน้นภาษาไทยเป็นหลัก (Thai-first UI)

### 🌟 คุณสมบัติเด่น (Key Features)

- 📦 **ทะเบียนครุภัณฑ์และวัสดุ (Registry & Inventory)**:
  - จัดการข้อมูล เพิ่ม ลบ แก้ไข รายการทรัพย์สิน พร้อมรหัสครุภัณฑ์, หมายเลขซีเรียล (Serial Number), สถานที่จัดเก็บ, หมวดหมู่ และหน่วยนับ
  - รองรับหมวดหมู่ครุภัณฑ์มาตรฐานสำนักงบประมาณและกรมบัญชีกลาง (13 หมวดมาตรฐาน)
- 🏷️ **QR Code / ฉลากครุภัณฑ์ (Asset Tags & Labels)**:
  - สร้างและพิมพ์สติกเกอร์/ป้าย QR Code สำหรับติดทรัพย์สิน รองรับทั้งกระดาษ A4 และ Thermal Roll พร้อมระบบสแกนตรวจสอบ
- 📉 **คำนวณค่าเสื่อมราคา (Depreciation Tracking)**:
  - ติดตามอายุการใช้งาน คำนวณมูลค่าคงเหลือและค่าเสื่อมราคาอัตโนมัติ
- 🖼️ **ระบบจัดการรูปภาพ (Image Processing)**:
  - ครอปและบีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลด เก็บรูปภาพปลอดภัยผ่าน Supabase Storage หรือระบบ Authenticated Local File Storage
- 📊 **รายงานและการส่งออกข้อมูล (Reports & Export)**:
  - สรุปรายงานและส่งออกไฟล์ **Excel (.xlsx)** และ **PDF** พร้อมระบบตรวจจับและยืนยันสิทธิ์เซสชันฝั่ง Server
- 👥 **ระบบสิทธิ์และการรักษาความปลอดภัย (RBAC & Security)**:
  - **Admin (ผู้ดูแลระบบ)**: สิทธิ์สมบูรณ์ จัดการบทบาทผู้ใช้ การตั้งค่า ตรวจสอบฐานข้อมูล และลบรายการ (มีระบบป้องกันตนเองและป้องกัน Last-Admin Lockout)
  - **Staff (เจ้าหน้าที่)**: บันทึก/อัปเดตข้อมูล ทำรายการแบบกลุ่ม และดูข้อมูลอ้างอิง (ไม่สามารถลบรายการหรือจัดการผู้ใช้ได้)
  - **Viewer (ผู้เข้าชม)**: เรียกดูข้อมูล ค้นหา และดูรายงานได้เท่านั้น (Read-only)
- ⚡ **อัปเดตข้อมูลแบบ Realtime**:
  - หน้ารายการ, Dashboard, รายงาน และ Audit Log รีเฟรชทันทีเมื่อมีการแก้ไขข้อมูลส่วนกลาง
- 🇹🇭 **มาตรฐานภาษาไทยและฟอนต์ (Thai-first UI & Unicode Hardening)**:
  - แสดงผลด้วยฟอนต์ *Sarabun* ร่วมกับ *Capriola*
  - รองรับระบบเรียงลำดับพจนานุกรมไทยด้วย ICU Collation (`th-TH-x-icu`)
  - ทำความสะอาดข้อความด้วย NFC Normalization และตัดอักขระล่องหนอัตโนมัติ

---

## English Overview

**CAMMS (Center Asset & Material Management System)** is an enterprise web application designed for Thai government and modern organizational units to track, audit, and manage shared office assets and materials. Built with **Next.js 16 (App Router)**, CAMMS seamlessly supports both **Supabase** and **standalone Docker PostgreSQL** backends.

### 🌟 Key Highlights

- **Complete Inventory Registry**: Full CRUD operations with custom asset numbers, serial numbers, locations, categories, and units. Preloaded with standard Thai Government asset categories.
- **Asset Tags & QR Printing**: Instant QR code label generation supporting standard A4 sticker layouts and thermal roll printers.
- **Depreciation Calculation**: Automated asset lifespan and depreciation calculation with remaining value tracking.
- **Client-Side Image Optimization**: High-performance cropping and compression before uploading to Supabase Storage or private local disk storage.
- **Data Export & Reporting**: Server-authenticated dataset queries with high-fidelity **Excel (.xlsx)** and browser **PDF** export.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (`Admin`, `Staff`, `Viewer`) with defense-in-depth route guards and anti-lockout safeguards.
- **Realtime Synchronization**: Instant updates across inventory registers, dashboards, reports, and mutation audit logs.
- **Thai-first & Accessible UI**: Dual typography (*Sarabun* + *Capriola*), 100% semantic color tokens with seamless dark/light modes, and ICU-level Thai collation (`th-TH-x-icu`).

---

## 🛠️ สถาปัตยกรรมและเทคโนโลยี (Tech Stack)

| เลเยอร์ (Layer) | เทคโนโลยีที่ใช้ (Technology) |
| :--- | :--- |
| **Framework** | [Next.js 16.3.8](https://nextjs.org/) (App Router, Webpack, `proxy.ts` middleware) |
| **UI & Styling** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/) |
| **Typography** | Sarabun (ภาษาไทย) & Capriola (ละตินและตัวเลข) |
| **Database & ORM** | [PostgreSQL 16+](https://www.postgresql.org/) / [Supabase](https://supabase.com/) + [Drizzle ORM](https://orm.drizzle.team/), Row-Level Security (RLS) |
| **Auth** | Supabase Auth หรือ Local Docker Postgres Auth (`private_auth` schema) |
| **Validation** | [Zod v4](https://zod.dev/) + Custom Unicode/NFC Sanitization |
| **Export Engines** | [ExcelJS](https://github.com/exceljs/exceljs) (.xlsx) & Browser Print-to-PDF Engine |
| **Quality & Testing**| TypeScript 5.x (Strict), ESLint 9 (Flat Config), Playwright, Node Test Runner |

---

## 🚀 เริ่มต้นใช้งาน (Quick Start)

### 1. ความต้องการของระบบ (Prerequisites)

- **Node.js**: `>=24.0.0 <25` (LTS)
- **npm**: `11.14.1`
- **Docker & Docker Compose** (กรณีเลือกใช้ Standalone PostgreSQL) หรือ **Supabase Account**

### 2. การตั้งค่า Environment Variables

คัดลอกไฟล์ตัวอย่าง `.env.example` หรือสร้างไฟล์ `.env.local` ในรูทของโปรเจกต์:

#### สำหรับการใช้งานผ่าน Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### สำหรับการใช้งานผ่าน Local Docker PostgreSQL:
> ศึกษาคู่มือแบบละเอียดที่หัวข้อ [การรันระบบด้วย Docker](#-การรันระบบด้วย-docker-docker-execution-guide) หรือ [docs/postgres/README.md](docs/postgres/README.md)
```bash
# 1. ติดตั้งคอนฟิกและสร้างฐานข้อมูล Docker
npm run postgres:setup
npm run postgres:up
npm run postgres:app:setup

# 2. สลับค่ามาใช้งาน Local Docker PostgreSQL
npm run postgres:activate
```

### 3. การติดตั้งและรันเซิร์ฟเวอร์ (Installation & Run)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. ตรวจสอบความถูกต้องของ Environment Variables
npm run verify-env

# 3. รัน Development Server
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

---

## 🐳 การรันระบบด้วย Docker (Docker Execution Guide)

ระบบ CAMMS ออกแบบให้สามารถรันบนสภาพแวดล้อม Docker ได้อย่างยืดหยุ่น โดยแบ่งรูปแบบการรันออกเป็น **3 รูปแบบหลัก** ตามลักษณะการใช้งาน:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      เลือกรูปแบบการรันด้วย Docker                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Local Database Container    │ ฐานข้อมูล PostgreSQL บน Docker        │
│    (เหมาะสำหรับการพัฒนา/ทั่วไป) │ + เว็บ Next.js รันบนเครื่อง Host     │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Full-Stack Production       │ เว็บ Next.js Standalone + Caddy HTTPS │
│    (เหมาะสำหรับ Production/Staging) │ + ฐานข้อมูล PostgreSQL บน Docker ทั้งหมด │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Standalone Docker Image     │ Build Image เดี่ยวด้วยคำสั่ง Docker   │
│    (เหมาะสำหรับ CI/CD & Deploy) │ มาตรฐาน เพื่อนำไปรันบน Container Host │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### รูปแบบที่ 1: รันฐานข้อมูลบน Docker + เว็บ Next.js บนเครื่อง (แนะนำสำหรับการพัฒนา)

ในรูปแบบนี้ ฐานข้อมูล PostgreSQL 17 จะทำงานใน Docker Container แบบแยกเดี่ยว มี Volume เก็บข้อมูลถาวร และเว็บรันผ่าน Node.js ในเครื่อง

#### คำสั่งการติดตั้งและรันครั้งแรก:
```bash
# 1. ติดตั้งไลบรารี
npm ci

# 2. สร้างคอนฟิกรหัสผ่านและไฟล์ .env.postgres.* อัตโนมัติ
npm run postgres:setup

# 3. เริ่มการทำงานของ PostgreSQL Container ผ่าน Docker Compose
npm run postgres:up

# 4. รัน Drizzle Migrations สร้างตาราง สิทธิ์ RBAC และบัญชีผู้ดูแลเริ่มต้น
npm run postgres:app:setup

# 5. สลับค่า .env.local ให้เชื่อมต่อกับ Docker PostgreSQL (พอร์ต 15432)
npm run postgres:activate

# 6. เริ่มการทำงานของเว็บแอปพลิเคชัน
npm run dev
```

#### ข้อมูลการเข้าใช้งานเริ่มต้น:
- **URL เว็บไซต์:** [http://localhost:3000](http://localhost:3000) (หรือ [http://127.0.0.1:3000](http://127.0.0.1:3000))
- **อีเมลผู้ดูแลเริ่มต้น:** `admin@camms.local`
- **รหัสผ่านผู้ดูแล:** สุ่มสร้างไว้ในไฟล์ `.env.postgres.admin` (สามารถเปิดดูและนำมาล็อกอิน จากนั้นเปลี่ยนรหัสผ่านได้ที่หน้า Profile)
- **พอร์ตฐานข้อมูล:** `127.0.0.1:15432` (ฐานข้อมูล: `camms_registry`)

#### คำสั่งเปิด/ปิดฐานข้อมูลในแต่ละวัน:
```bash
# หยุดการทำงานของฐานข้อมูล (เก็บข้อมูลใน Volume ถาวร)
npm run postgres:stop

# เริ่มการทำงานของฐานข้อมูลกลับขึ้นมา
npm run postgres:up
```

---

### รูปแบบที่ 2: รันทั้งระบบด้วย Docker Compose (Full-Stack Production with HTTPS)

ในรูปแบบนี้ ระบบจะรันผ่าน Docker Container ทั้งหมด 100%:
1. **Next.js Web Container**: Standalone build แบบ Non-root user (UID 10001) ปลอดภัยสูง
2. **Caddy Reverse Proxy**: จัดการ HTTPS/TLS Certificate อัตโนมัติและจำกัดเส้นทาง
3. **PostgreSQL Container**: ฐานข้อมูลพร้อม Volume และ Isolated Network

#### ขั้นตอนและคำสั่งรัน:

```bash
# ขั้นตอนที่ 1: ตรวจสอบว่าฐานข้อมูล Docker รันและ Setup เรียบร้อยแล้ว
npm run postgres:setup
npm run postgres:up
npm run postgres:app:setup

# ขั้นตอนที่ 2: เตรียมการกำหนดค่า Production Endpoint
# กรณี ก) ทดสอบบนเครื่องตัวเองผ่าน HTTPS (พอร์ต 8443 / 8080):
npx tsx scripts/prepare-production.ts --site localhost --tls internal --https-port 8443 --http-port 8080

# กรณี ข) รันใช้งานจริงด้วยชื่อโดเมน (Public Domain):
# npx tsx scripts/prepare-production.ts --site asset.yourdomain.go.th --tls public --bind 0.0.0.0

# ขั้นตอนที่ 3: Build Docker Image ของแอปพลิเคชัน
docker compose --env-file .env.production.compose -f compose.production.yaml build

# ขั้นตอนที่ 4: สั่งรัน Containers ทั้งหมดในโหมด Background (-d)
docker compose --env-file .env.production.compose -f compose.production.yaml up -d --wait --wait-timeout 120

# ขั้นตอนที่ 5: ตรวจสอบสถานะการทำงานและ Health Status
docker compose --env-file .env.production.compose -f compose.production.yaml ps
```

#### การเข้าใช้งาน:
- เปิดเบราว์เซอร์ไปที่: `https://localhost:8443` (หรือโดเมนที่กำหนด)
- ตรวจสอบสถานะ Health Endpoint:
  ```bash
  curl -k https://localhost:8443/api/health/readiness
  # คืนค่า: {"status":"ok",...}
  ```

#### คำสั่งจัดการ Production Compose:
```bash
# ดู Log การทำงานแบบ Realtime
docker compose --env-file .env.production.compose -f compose.production.yaml logs -f app

# รีสตาร์ทเซอร์วิสเว็บและพร็อกซี
docker compose --env-file .env.production.compose -f compose.production.yaml restart app proxy

# หยุดการทำงานของระบบ
docker compose --env-file .env.production.compose -f compose.production.yaml stop
```

---

### รูปแบบที่ 3: การ Build & Run ด้วยคำสั่ง Docker มาตรฐาน (Single Container)

สำหรับทีม DevOps ที่ต้องการนำ Image ไปรันบน Kubernetes, Cloud Run หรือ Container Registry:

#### 1. Build Image:
```bash
docker build -t camms-portal:latest .
```

#### 2. Run Container:
```bash
docker run -d \
  --name camms-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATA_BACKEND=postgres \
  -e NEXT_PUBLIC_DATA_BACKEND=postgres \
  -e LOCAL_STORAGE_PATH=/data/storage \
  -v camms_storage_data:/data/storage \
  camms-portal:latest
```

---

### 🤖 การรัน AI Autonomous UAT ร่วมกับระบบบน Docker

เมื่อรันระบบ CAMMS ผ่าน Docker (ไม่ว่าจะรันบนพอร์ต 3000, 3001 หรือ 8443) คุณสามารถสั่งให้ AI Agent (Google Gemini API) เข้าตรวจรับระบบแบบอัตโนมัติได้ทันที:

```bash
# รัน AI UAT ครบทุกบทบาท (Admin, Staff, Viewer) ชี้ไปยัง Docker พอร์ต 3000
npm run test:uat:ai

# รันแบบเปิดหน้าต่างเบราว์เซอร์สด (Headed Mode) ให้เห็น AI คลิกและพิมพ์
npm run test:uat:ai:headed

# รันโดยระบุ URL หรือพอร์ตที่รันบน Docker โดยตรง
npx tsx scripts/ai-uat/run.ts --url http://localhost:3001

# ทดสอบเฉพาะบทบาทที่ต้องการ
npm run test:uat:ai:admin
npm run test:uat:ai:staff
npm run test:uat:ai:viewer
```
หลังการทดสอบสิ้นสุด AI จะออกรายงาน **Interactive HTML Report** ให้ที่ `test-results/uat/index.html` อัตโนมัติ

---

## 📜 คำสั่งพัฒนาที่สำคัญ (CLI Commands)

| คำสั่ง (Command) | รายละเอียด (Description) |
| :--- | :--- |
| `npm run check` | **Full Quality Gate**: ตรวจสอบ env, รัน unit/component tests, lint โค้ด และ build |
| `npm run dev` | รัน Next.js Development Server |
| `npm run build` | คอมไพล์โปรเจกต์สำหรับ Production พร้อมตรวจ Bundle Budget |
| `npm run typecheck` | ตรวจสอบ Strict TypeScript types และ Dead Code |
| `npm run lint` | ตรวจสอบ Linting ด้วย ESLint 9 (Flat Config) |
| `npm test` | รัน Test Suite ทั้งหมดผ่าน Node test runner (`tsx`) |
| `npm run test:uat:ai` | **AI Autonomous UAT**: ตรวจรับระบบอัตโนมัติด้วย Google Gemini API (ครบทุก Role) |
| `npm run test:uat:ai:headed` | รัน AI UAT แบบเปิดหน้าต่างเบราว์เซอร์สด (Headed Mode) |
| `npm run test:uat:ai:admin` | รัน AI UAT เฉพาะสิทธิ์ผู้ดูแลระบบ (Admin Scenarios) |
| `npm run test:uat:ai:staff` | รัน AI UAT เฉพาะสิทธิ์เจ้าหน้าที่ (Staff Scenarios) |
| `npm run test:uat:ai:viewer` | รัน AI UAT เฉพาะสิทธิ์ผู้เข้าชม (Viewer Scenarios) |
| `npm run test:e2e` | รัน Playwright End-to-End (E2E) Browser Tests |
| `npm run test:smoke` | รัน Playwright Smoke Tests |
| `npm run verify-env` | ตรวจสอบความสมบูรณ์ของค่าตัวแปรใน `.env.local` |
| `npm run verify-db-release` | ตรวจสอบสถานะ Migrations, สิทธิ์ RPC และ RLS Policies แบบ Read-only |
| `npm run postgres:setup` | ติดตั้งและกำหนดค่า Docker PostgreSQL เริ่มต้น |
| `npm run postgres:up` | เริ่มการทำงานของ Docker PostgreSQL Container |
| `npm run postgres:stop` | หยุดการทำงานของ Docker PostgreSQL Container (คงข้อมูลใน Volume) |
| `npm run postgres:app:setup` | รัน Migration และสร้างบัญชี Admin เริ่มต้นสำหรับ Docker |
| `npm run postgres:activate` | สลับค่า `.env.local` มาใช้งาน Local Docker PostgreSQL |
| `npm run health:diagnose` | ตรวจสอบความผิดปกติของข้อมูลใน Database และ Storage |
| `npm run health:heal` | ซ่อมแซมและแก้ไขข้อมูลที่ตรวจพบความผิดปกติโดยอัตโนมัติ |
| `npm run mcp` | เริ่มการทำงานของ Local Model Context Protocol (MCP) Server |

---

## 🗄️ ฐานข้อมูลและ Migrations (Database Management)

ระบบจัดการโครงสร้างฐานข้อมูลผ่านไฟล์ SQL ใน `db/migrations/`:

```bash
# นำเข้าหมวดหมู่ครุภัณฑ์ตามมาตรฐานสำนักงบประมาณ (13 หมวดหมู่มาตรฐาน)
npx tsx scripts/seed-asset-categories.ts

# Apply Migrations ไปยังฐานข้อมูลเป้าหมาย
$env:MIGRATION_FILES='00001_initial_schema.sql,00002_units_active_columns.sql'
npx tsx scripts/apply-migrations.ts
```

---

## 🔒 ข้อกำหนดทางสถาปัตยกรรม (Architectural Rules)

1. **Client / Server Separation**:
   - Server Components ทำหน้าที่ดึงข้อมูลผ่าน `features/<domain>/queries.ts`
   - การเปลี่ยนแปลงข้อมูล (Mutations) ต้องทำผ่าน Server Actions ใน `features/<domain>/actions.ts` เท่านั้น
2. **Dual-Client Security**:
   - ห้ามเปิดเผย `SUPABASE_SERVICE_ROLE_KEY` ไปยัง Client เด็ดขาด
   - สิทธิ์ RLS บังคับใช้กับทุก Session ปกติ
3. **Anti-Lockout Safeguards**:
   - ผู้ดูแลระบบไม่สามารถลดสิทธิ์ ลบ หรือระงับการใช้งานบัญชีตนเองได้ และระบบจะป้องกันไม่ให้ระบบขาดผู้ดูแลระบบคนสุดท้ายเสมอ
4. **Cache Revalidation**:
   - ทุกครั้งที่มีการเพิ่ม/แก้ไข/ลบข้อมูล ต้องเรียก `revalidatePath('/', 'layout')` เพื่ออัปเดตตัวเลขใน Sidebar เสมอ

---

## 📚 เอกสารเพิ่มเติม (Documentation)

- [Docker PostgreSQL Setup Guide](docs/postgres/README.md) — คู่มือการติดตั้งและบริหาร Docker Postgres
- [Product Context & Scope](docs/context/PRODUCT.md) — วัตถุประสงค์และขอบเขตของผลิตภัณฑ์
- [Agent & Engineering Rules](docs/context/AGENTS.md) — กฎและระเบียบสำหรับ Agent & Developer
- [Codebase Cleanup Report](docs/cleanup/README.md) — สรุปการตรวจสอบและทำความสะอาดโค้ด

---

## 📄 ใบอนุญาต (License)

CAMMS Portal จัดทำขึ้นเพื่อใช้งานภายในหน่วยงาน (Internal Use Only)
