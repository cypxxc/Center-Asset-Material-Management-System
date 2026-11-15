# 🤖 CAMMS — Agent Setup & Onboarding Guide

> **สำหรับ AI Agent (Claude Code, Cursor, Windsurf, GitHub Copilot, Antigravity ฯลฯ):**  
> เอกสารนี้คือ **Runbook มาตรฐาน** สำหรับให้ Agent อ่านและดำเนินการติดตั้ง Dependencies, ตั้งค่าสภาพแวดล้อม (Environment), ฐานข้อมูล (Database), และทดสอบระบบให้พร้อมใช้งานทันทีหลังจากที่มีผู้ clone/download โปรเจกต์นี้มา

---

## 📌 สรุปขั้นตอนด่วนสำหรับ Agent (Quick Execution Checklist)

Agent สามารถรันตาม 5 ลำดับขั้นตอนนี้ได้ทันที:

```
[ขั้นตอนที่ 0] ตรวจสอบ Node.js & npm version
       ↓
[ขั้นตอนที่ 1] ติดตั้ง Dependencies (`npm install`)
       ↓
[ขั้นตอนที่ 2] ตั้งค่าฐานข้อมูล (เลือก Docker PostgreSQL หรือ Supabase)
       ↓
[ขั้นตอนที่ 3] ตรวจสอบความถูกต้องและทดสอบระบบ (`npm run verify-env` และ `npm test`)
       ↓
[ขั้นตอนที่ 4] เริ่มรันระบบ (`npm run dev`)
```

---

## 📚 ลำดับการอ่านเอกสารบริบท (Mandatory Context Order)

ก่อนเริ่มเขียนโค้ดหรือปรับแต่งระบบ Agent **ต้อง** อ่านไฟล์บริบทตามลำดับนี้:
1. [`docs/context/PRODUCT.md`](docs/context/PRODUCT.md) — วัตถุประสงค์ระบบ, บทบาทผู้ใช้งาน (RBAC), กฎเกณฑ์ UI ภาษาไทย
2. [`docs/context/README.md`](docs/context/README.md) — ภาพรวมสถาปัตยกรรมและโครงสร้างโฟลเดอร์
3. [`docs/context/AGENTS.md`](docs/context/AGENTS.md) — กฎเฉพาะของ Next.js 16 และข้อห้ามสำคัญ

---

## ⚙️ ขั้นตอนที่ 0: ตรวจสอบความต้องการของสภาพแวดล้อม (Prerequisites)

ให้ Agent ตรวจสอบเครื่องของผู้ใช้ด้วยคำสั่งต่อไปนี้:

### 1. ตรวจสอบเวอร์ชัน Node.js
```bash
node -v
```
- **ข้อกำหนด:** ต้องเป็น Node.js `>=24.0.0 <25` (LTS) ตามที่ระบุใน `package.json`

### 2. ตรวจสอบเวอร์ชัน npm
```bash
npm -v
```
- **ข้อกำหนด:** แนะนำ `npm@11.14.1` (หรือเวอร์ชัน 10.x - 11.x ที่เข้ากันได้)

### 3. ตรวจสอบ Docker (หากเลือกใช้ Docker PostgreSQL)
```bash
docker info
```
- ต้องเปิดใช้งาน Docker Desktop หรือ Docker Daemon เรียบร้อยแล้ว

---

## 📦 ขั้นตอนที่ 1: ติดตั้ง Dependencies

รันคำสั่งติดตั้งแพ็กเกจ:

```bash
npm install
```
*(หรือใช้ `npm ci` หากต้องการยึดตาม `package-lock.json` อย่างเคร่งครัด)*

---

## 🗄️ ขั้นตอนที่ 2: ตั้งค่าฐานข้อมูลและสภาพแวดล้อม (Database Setup)

ระบบ CAMMS รองรับฐานข้อมูล 2 รูปแบบ ให้ Agent ตรวจสอบหรือสอบถามผู้ใช้:

---

### 👉 ทางเลือก A: ใช้งาน Standalone Docker PostgreSQL (แนะนำสำหรับ Local Dev)
> *เหมาะสำหรับการรันในเครื่องทันที โดยไม่ต้องสมัคร Cloud Service ใด ๆ*

ให้ Agent รันคำสั่งต่อไปนี้ตามลำดับ:

```bash
# 1. สร้างไฟล์คอนฟิก .env.postgres.local พร้อมสร้างรหัสผ่านที่ปลอดภัยแบบสุ่ม
npm run postgres:setup

# 2. เริ่มต้น Docker Container สำหรับ PostgreSQL (รันที่พอร์ต 15432)
npm run postgres:up

# 3. สร้างฐานข้อมูล camms_registry, สร้าง role, รัน Drizzle Migrations และสร้างแอดมินเริ่มต้น
npm run postgres:app:setup

# 4. อัปเดต .env.local ให้ชี้ไปที่ Docker PostgreSQL (สำรองค่าเดิมไว้ที่ .cache/postgres/)
npm run postgres:activate

# 5. ใส่ข้อมูลหมวดหมู่ครุภัณฑ์มาตรฐานราชการไทย 13 หมวด (7110, 7440 ฯลฯ)
npx tsx scripts/seed-asset-categories.ts
```

#### 🔑 ข้อมูลบัญชีผู้ดูแลระบบเริ่มต้น (Default Admin):
- **Email:** `admin@camms.local`
- **Password:** ตรวจสอบได้ในไฟล์ `.env.postgres.admin` (สร้างขึ้นอัตโนมัติจากการรัน `postgres:app:setup`)
- **Web Portal:** `http://localhost:3000`

---

### 👉 ทางเลือก B: ใช้งาน Supabase (Cloud Database)
> *เหมาะสำหรับกรณีที่มีโปรเจกต์ Supabase อยู่แล้ว*

1. คัดลอกไฟล์ตัวอย่าง `.env.example` เป็น `.env.local`:
   ```bash
   # Windows (PowerShell):
   Copy-Item .env.example .env.local

   # macOS / Linux (Bash):
   cp .env.example .env.local
   ```
2. แก้ไขไฟล์ `.env.local` ใส่ค่าจริงจากแดชบอร์ด Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
3. รัน Migration ไปยัง Supabase:
   ```bash
   npx tsx scripts/apply-migrations.ts
   ```
4. ใส่ข้อมูลหมวดหมู่ครุภัณฑ์มาตรฐาน:
   ```bash
   npx tsx scripts/seed-asset-categories.ts
   ```

---

## 🧪 ขั้นตอนที่ 3: ตรวจสอบความพร้อมและทดสอบระบบ (Verification)

ก่อนเริ่มงานพัฒนา ให้ Agent ตรวจสอบความถูกต้องเพื่อยืนยันว่าระบบพร้อม 100%:

### 1. ตรวจสอบ Environment Variables
```bash
npm run verify-env
```
*(ต้องผ่านโดยไม่มี error แจ้งเตือน missing variables)*

### 2. ตรวจสอบ Type และ Dead Code
```bash
npm run typecheck
```

### 3. รันชุดการทดสอบพื้นฐาน (Unit & Integration Tests)
```bash
npm test
```

### 4. รันตรวจสอบสุขภาพระบบและวินิจฉัยปัญหาอัตโนมัติ (Self-Healing Check)
```bash
npm run health:diagnose
```
*(หากพบประเด็นที่แก้ไขได้อัตโนมัติ สามารถสั่ง `npm run health:heal`)*

---

## 🚀 ขั้นตอนที่ 4: รันระบบสำหรับการพัฒนา (Start Development)

เมื่อทุกขั้นตอนผ่านเรียบร้อย รัน Development Server:

```bash
npm run dev
```

- เปิดบราวเซอร์ที่: **`http://localhost:3000`**
- ระบบจะใช้ Next.js 16 ร่วมกับ Webpack ตามคอนฟิกของโปรเจกต์

---

## ⚠️ กฎเหล็กที่ Agent ต้องปฏิบัติตามอย่างเคร่งครัด (Hard Constraints)

```
❌ ห้ามเปิดเผยหรือใช้งาน SUPABASE_SERVICE_ROLE_KEY ใน Client Component โดยเด็ดขาด
❌ ห้ามแก้ไขสูตรคำนวณค่าเสื่อมราคา (Depreciation Formulas)
❌ ห้ามเปลี่ยนแปลงตรรกะสิทธิ์ RBAC (Admin, Staff, Viewer)
❌ ห้ามแก้ไขระเบียนฐานข้อมูลโดยตรง (ห้าม bypass RLS หรือข้าม audit triggers)
❌ ห้ามใช้ Label ที่มีเฉพาะสี (ต้องมีข้อความภาษาไทยและ Icon กำกับเสมอ)
```

### สถาปัตยกรรม Next.js 16 ของโปรเจกต์นี้:
1. **Server Components:** ดึงข้อมูลผ่าน `features/<domain>/queries.ts` เท่านั้น
2. **Mutations (การบันทึก/แก้ไข):** ทำผ่าน Server Actions ใน `features/<domain>/actions.ts` เท่านั้น
3. **Cache Invalidation:** ทุก Mutation ที่กระทบรายการครุภัณฑ์หรือหมวดหมู่ ต้องเรียก `revalidatePath('/', 'layout')` เพื่ออัปเดตตัวเลข sidebar แบบ realtime
4. **ภาษาไทยและ Unicode:** ทุกข้อความที่บันทึกลงฐานข้อมูล ต้องผ่าน NFC normalization และตัดอักขระล่องหนผ่าน `lib/unicode.ts`

---

## 🛠️ คู่มือแก้ไขปัญหาที่พบบ่อยสำหรับ Agent (Troubleshooting Guide)

| อาการ / ปัญหา | สาเหตุ | วิธีแก้สำหรับ Agent |
| :--- | :--- | :--- |
| **พอร์ต 15432 ชน (Port in use)** | มี process อื่นใช้พอร์ต 15432 อยู่ | แก้ไขค่า `POSTGRES_PORT` ในไฟล์ `.env.postgres.local` แล้วสั่ง `npm run postgres:up` ใหม่ |
| **Docker Compose ล้มเหลว** | Docker Desktop ยังไม่เปิด | ตรวจสอบสถานะด้วย `docker info` และแจ้งเตือนให้ผู้ใช้เปิด Docker Desktop |
| **Missing required environment variables** | ยังไม่ได้ activate postgres หรือยังไม่มี `.env.local` | ตรวจสอบว่าได้รัน `npm run postgres:activate` หรือสร้าง `.env.local` แล้วหรือไม่ |
| **ESLint / TypeScript Error** | ติด typecheck หรือ rule strict | รัน `npm run typecheck` และ `npm run lint` เพื่อดูตำแหน่งข้อผิดพลาด |
| **ต้องการรีเซ็ตฐานข้อมูล Docker ใหม่ทั้งหมด** | ต้องการล้างข้อมูลเริ่มต้นใหม่ | สั่ง `npm run postgres:stop` แล้วลบ Docker Volume `camms-postgres-local_postgres_data` จากนั้นรัน `postgres:setup` และ `postgres:up` ใหม่ |

---

## 📋 คำสั่งที่มีประโยชน์เพิ่มเติม (Useful Scripts)

- `npm run check` — รัน Full Quality Gate (verify-env + test + lint + production build)
- `npm run test:smoke` — รัน Playwright Smoke Tests
- `npm run test:e2e` — รัน End-to-End Tests
- `npm run postgres:test` — ตรวจสอบการเชื่อมต่อและการ Rollback ของ Docker PostgreSQL
- `npm run mcp` — เริ่มต้น Local MCP Server สำหรับการพัฒนาต่อยอดร่วมกับ AI Tools
