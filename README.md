# CAMMS Portal — Center Asset & Material Management System
### ระบบบริหารจัดการทรัพย์สินและวัสดุส่วนกลาง

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Supported-3ECF8E?logo=supabase)](https://supabase.com/)

[English](#english-overview) • [ภาษาไทย](#ภาพรวมระบบภาษาไทย)

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
> ศึกษาคู่มือการติดตั้งแบบ Docker ละเอียดที่ [docs/postgres/README.md](docs/postgres/README.md)
```bash
# ติดตั้ง Docker Container และตั้งค่าคอนฟิกอัตโนมัติ
npm run postgres:setup
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

## 📜 คำสั่งพัฒนาที่สำคัญ (CLI Commands)

| คำสั่ง (Command) | รายละเอียด (Description) |
| :--- | :--- |
| `npm run check` | **Full Quality Gate**: ตรวจสอบ env, รัน unit/component tests, lint โค้ด และ build |
| `npm run dev` | รัน Next.js Development Server |
| `npm run build` | คอมไพล์โปรเจกต์สำหรับ Production พร้อมตรวจ Bundle Budget |
| `npm run typecheck` | ตรวจสอบ Strict TypeScript types และ Dead Code |
| `npm run lint` | ตรวจสอบ Linting ด้วย ESLint 9 (Flat Config) |
| `npm test` | รัน Test Suite ทั้งหมดผ่าน Node test runner (`tsx`) |
| `npm run test:e2e` | รัน Playwright End-to-End (E2E) Browser Tests |
| `npm run test:smoke` | รัน Playwright Smoke Tests |
| `npm run verify-env` | ตรวจสอบความสมบูรณ์ของค่าตัวแปรใน `.env.local` |
| `npm run verify-db-release` | ตรวจสอบสถานะ Migrations, สิทธิ์ RPC และ RLS Policies แบบ Read-only |
| `npm run postgres:setup` | ติดตั้งและกำหนดค่า Docker PostgreSQL เริ่มต้น |
| `npm run postgres:up` | เริ่มการทำงานของ Docker PostgreSQL Container |
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
