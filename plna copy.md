# PLAN.md — Office Item Registry System

> ระบบทะเบียนสิ่งของสำนักงานแบบเรียบง่าย  
> ใช้สำหรับบันทึกว่า “ในสำนักงานมีสิ่งของอะไรอยู่บ้าง”  
> ไม่ใช่ระบบคลังพัสดุเต็มรูปแบบ

---

## 1. Project Overview

### 1.1 ชื่อระบบ

**Office Item Registry System**  
หรือชื่อภาษาไทย: **ระบบทะเบียนสิ่งของสำนักงาน**

### 1.2 วัตถุประสงค์

ระบบนี้ใช้สำหรับบันทึกข้อมูลสิ่งของ วัสดุ อุปกรณ์ทั่วไป และครุภัณฑ์ภายในสำนักงาน เพื่อให้สามารถตรวจสอบได้ว่า:

- มีสิ่งของอะไรอยู่ในสำนักงาน
- จำนวนเท่าไหร่
- อยู่ที่ไหน
- ใครรับผิดชอบ
- สถานะปัจจุบันเป็นอย่างไร
- มีรูปภาพหรือข้อมูลประกอบหรือไม่

### 1.3 ขอบเขตของระบบ

ระบบนี้เป็นระบบทะเบียนข้อมูล ไม่ใช่ระบบคลังพัสดุเต็มรูปแบบ

ระบบต้องทำได้:

- บันทึกรายการสิ่งของ
- แก้ไขรายการสิ่งของ
- ดูรายละเอียดสิ่งของ
- ค้นหาและกรองข้อมูล
- แยกข้อมูลตามประเภท หมวดหมู่ สถานที่ และสถานะ
- แนบรูปภาพสิ่งของ
- Export รายงานเป็น Excel/PDF
- ใช้งานผ่านระบบ Cloud 100%
- มีระบบ Login และ Role-based Permission

ระบบไม่ต้องทำ:

- ไม่ต้องรับเข้า
- ไม่ต้องเบิกออก
- ไม่ต้องตัดสต็อก
- ไม่ต้องทำ Stock Movement
- ไม่ต้องทำระบบอนุมัติ
- ไม่ต้องทำระบบยืม-คืน
- ไม่ต้องทำระบบซ่อมบำรุงเต็มรูปแบบ
- ไม่ต้องทำ Workflow ซับซ้อน

---

## 2. Key Requirements

### 2.1 Functional Requirements

ระบบต้องมีหน้าหลักดังนี้:

1. Login
2. Dashboard
3. Items List
4. Create Item
5. Edit Item
6. Item Detail
7. Reports
8. Settings

### 2.2 Non-functional Requirements

- Cloud 100%
- คนใช้งานไม่เยอะ
- ต้องการความเร็ว
- ดูแลง่าย
- ไม่ต้องมี Server เอง
- UI เรียบง่าย เป็นทางการ
- Responsive ใช้ได้ทั้ง Desktop และ Mobile
- มีระบบสิทธิ์ผู้ใช้งาน
- มีการ Validate ข้อมูล
- ใช้ Soft Delete แทนการลบถาวร
- มี Audit Log สำหรับ Action สำคัญ

---

## 3. Recommended Tech Stack

| Layer | Technology | เหตุผล |
|---|---|---|
| Frontend / Full-stack | Next.js App Router + TypeScript | ทำ Web App และ Backend Logic ในโปรเจกต์เดียว |
| UI | Tailwind CSS + shadcn/ui | ทำ UI เรียบง่าย เป็นทางการ และปรับแต่งง่าย |
| Database | Supabase PostgreSQL | ฐานข้อมูล Cloud แบบ Relational เหมาะกับข้อมูลทะเบียน |
| Auth | Supabase Auth | ใช้ Login และจัดการ Session ได้ง่าย |
| Storage | Supabase Storage | เก็บรูปภาพสิ่งของ |
| Hosting | Vercel | เหมาะกับ Next.js และ Deploy ง่าย |
| Form | React Hook Form + Zod | จัดการ Form และ Validate ข้อมูล |
| Table | TanStack Table | ตารางค้นหา กรอง เรียงข้อมูลได้ดี |
| Excel Export | ExcelJS | Export รายการเป็น Excel |
| PDF Export | pdfmake หรือ jsPDF | Export รายงาน PDF |
| Version Control | GitHub | เก็บ Code และเชื่อมกับ Vercel |

### 3.1 Stack หลักที่เลือกใช้

```text
Next.js App Router
TypeScript
Tailwind CSS
shadcn/ui
Supabase PostgreSQL
Supabase Auth
Supabase Storage
Vercel
React Hook Form
Zod
TanStack Table
ExcelJS
pdfmake หรือ jsPDF
GitHub
```

---

## 4. High-level Architecture

### 4.1 Architecture Overview

```text
User Browser
   ↓
Vercel / Next.js App
   ↓
Next.js App Router
   ↓
Server Components / Server Actions
   ↓
Supabase
   ├── Supabase Auth
   ├── PostgreSQL Database
   ├── Supabase Storage
   └── Row Level Security
```

### 4.2 Cloud Architecture

```text
Frontend Hosting  : Vercel
Database          : Supabase PostgreSQL
Authentication    : Supabase Auth
File Storage      : Supabase Storage
Source Code       : GitHub
Deployment        : GitHub → Vercel
```

### 4.3 Design Principle

- ใช้ Next.js เป็น Full-stack App
- ใช้ Supabase เป็น Backend-as-a-Service
- ใช้ Server Components สำหรับหน้าที่เน้นอ่านข้อมูล
- ใช้ Client Components เฉพาะส่วนที่ต้อง Interactive
- ใช้ Server Actions สำหรับ Create / Update / Delete / Export
- ใช้ Soft Delete เพื่อเก็บประวัติข้อมูล
- ใช้ Pagination เพื่อให้หน้า List โหลดเร็ว
- ใช้ URL Query Params สำหรับ Search และ Filter
- ใช้ Role-based Permission เพื่อควบคุมสิทธิ์

---

## 5. Application Architecture

### 5.1 Folder Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── items/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/
│   │       └── page.tsx
│   │
│   ├── layout.tsx
│   └── globals.css
│
├── features/
│   ├── auth/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── components/
│   │
│   ├── dashboard/
│   │   ├── queries.ts
│   │   └── components/
│   │
│   ├── items/
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   ├── schema.ts
│   │   ├── types.ts
│   │   └── components/
│   │
│   ├── reports/
│   │   ├── actions.ts
│   │   └── components/
│   │
│   └── settings/
│       ├── actions.ts
│       ├── queries.ts
│       └── components/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-table/
│   └── shared/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   │
│   ├── permissions.ts
│   ├── constants.ts
│   └── utils.ts
│
├── db/
│   ├── migrations/
│   └── seed.sql
│
└── types/
```

---

## 6. User Roles and Permissions

### 6.1 Roles

ระบบมีผู้ใช้ 3 ระดับ

| Role | คำอธิบาย |
|---|---|
| Admin | จัดการระบบทั้งหมด |
| Staff | เพิ่มและแก้ไขข้อมูลสิ่งของ |
| Viewer | ดูข้อมูลอย่างเดียว |

### 6.2 Permission Matrix

| Feature | Admin | Staff | Viewer |
|---|---:|---:|---:|
| Login | ✅ | ✅ | ✅ |
| ดู Dashboard | ✅ | ✅ | ✅ |
| ดูรายการสิ่งของ | ✅ | ✅ | ✅ |
| ค้นหา/กรองข้อมูล | ✅ | ✅ | ✅ |
| ดูรายละเอียดสิ่งของ | ✅ | ✅ | ✅ |
| เพิ่มรายการสิ่งของ | ✅ | ✅ | ❌ |
| แก้ไขรายการสิ่งของ | ✅ | ✅ | ❌ |
| ลบแบบ Soft Delete | ✅ | ❌ | ❌ |
| Export รายงาน | ✅ | ✅ | ✅ |
| จัดการ Settings | ✅ | ❌ | ❌ |
| จัดการผู้ใช้ | ✅ | ❌ | ❌ |

---

## 7. Core Data Model

### 7.1 Entity Overview

```text
auth.users
   ↓
profiles

categories
   ↓
items

locations
   ↓
items

units
   ↓
items

items
   ↓
audit_logs
```

### 7.2 Main Tables

ระบบควรมีตารางหลักดังนี้:

1. profiles
2. categories
3. locations
4. units
5. items
6. audit_logs

---

## 8. Database Schema

### 8.1 profiles

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'staff', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

### 8.2 categories

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

ตัวอย่างหมวดหมู่:

```text
คอมพิวเตอร์
จอภาพ
เครื่องพิมพ์
โต๊ะ/เก้าอี้
อุปกรณ์สำนักงาน
อุปกรณ์ประชุม
วัสดุสิ้นเปลือง
```

---

### 8.3 locations

```sql
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building text,
  floor text,
  room text,
  department text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

ตัวอย่างสถานที่:

```text
ห้อง IT
ห้องประชุม
ห้องสำนักงาน
ห้องเก็บของ
ห้องผู้บริหาร
```

---

### 8.4 units

```sql
create table units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
```

ตัวอย่างหน่วยนับ:

```text
เครื่อง
ตัว
ชุด
อัน
กล่อง
รีม
ใบ
ชิ้น
```

---

### 8.5 items

```sql
create table items (
  id uuid primary key default gen_random_uuid(),

  item_name text not null,
  item_type text not null check (item_type in ('material', 'asset', 'general')),
  category_id uuid references categories(id),
  quantity integer not null default 1 check (quantity >= 0),
  unit_id uuid references units(id),

  asset_no text,
  serial_no text,
  brand text,
  model text,

  location_id uuid references locations(id),
  responsible_person text,

  status text not null default 'active' check (
    status in (
      'active',
      'spare',
      'damaged',
      'waiting_repair',
      'inactive',
      'disposed'
    )
  ),

  note text,
  image_url text,

  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  deleted_by uuid references profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 8.6 audit_logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
```

---

## 9. Database Indexes

### 9.1 Basic Indexes

```sql
create index idx_items_deleted_at on items(deleted_at);
create index idx_items_item_type on items(item_type);
create index idx_items_status on items(status);
create index idx_items_category_id on items(category_id);
create index idx_items_location_id on items(location_id);
create index idx_items_updated_at on items(updated_at desc);
```

### 9.2 Unique Index for Asset Number

```sql
create unique index unique_asset_no_not_deleted
on items(asset_no)
where asset_no is not null and deleted_at is null;
```

### 9.3 Unique Index for Serial Number

```sql
create unique index unique_serial_no_not_deleted
on items(serial_no)
where serial_no is not null and deleted_at is null;
```

### 9.4 Search Index

```sql
create index idx_items_search
on items
using gin (
  to_tsvector(
    'simple',
    coalesce(item_name,'') || ' ' ||
    coalesce(asset_no,'') || ' ' ||
    coalesce(serial_no,'') || ' ' ||
    coalesce(brand,'') || ' ' ||
    coalesce(model,'') || ' ' ||
    coalesce(responsible_person,'')
  )
);
```

---

## 10. Item Status

### 10.1 Internal Status Values

```text
active
spare
damaged
waiting_repair
inactive
disposed
```

### 10.2 Display Status

| Value | Display |
|---|---|
| active | ใช้งานอยู่ |
| spare | เก็บสำรอง |
| damaged | ชำรุด |
| waiting_repair | รอซ่อม |
| inactive | ไม่ใช้งาน |
| disposed | จำหน่าย/ตัดออก |

---

## 11. Main Application Flows

### 11.1 Login Flow

```text
User เปิดระบบ
   ↓
ตรวจ Supabase Session
   ↓
ถ้ายังไม่ Login → Redirect ไป /login
   ↓
ถ้า Login แล้ว → ดึงข้อมูล Profile
   ↓
ตรวจ Role และ is_active
   ↓
เข้า Dashboard
```

### 11.2 Dashboard Flow

```text
User เข้า /dashboard
   ↓
Server Component เรียก dashboard queries
   ↓
ดึงจำนวนสิ่งของทั้งหมด
   ↓
ดึงจำนวนแยกตามประเภท
   ↓
ดึงจำนวนแยกตามสถานะ
   ↓
ดึงรายการเพิ่มล่าสุด
   ↓
Render Dashboard Cards
```

### 11.3 View Items Flow

```text
User เข้า /items
   ↓
อ่าน URL Query Params
   ↓
q, type, category, location, status, page
   ↓
Server Query ไป Supabase
   ↓
Apply Search / Filter / Pagination
   ↓
Render Table
```

ตัวอย่าง URL:

```text
/items?q=printer&type=asset&status=active&page=1
```

### 11.4 Create Item Flow

```text
User กดเพิ่มสิ่งของ
   ↓
กรอก Form
   ↓
Client Validation ด้วย Zod
   ↓
Submit ไป Server Action
   ↓
Server Validation ซ้ำ
   ↓
ตรวจ Permission
   ↓
ตรวจ asset_no / serial_no ซ้ำ
   ↓
Insert ลง items
   ↓
Upload รูปภาพ ถ้ามี
   ↓
Update image_url
   ↓
บันทึก audit_logs
   ↓
Redirect ไปหน้า Item Detail
```

### 11.5 Edit Item Flow

```text
User เปิดหน้า Edit
   ↓
ระบบ Load ข้อมูลเดิม
   ↓
User แก้ไขข้อมูล
   ↓
Client Validation
   ↓
Submit ไป Server Action
   ↓
Server Validation
   ↓
ตรวจ Permission
   ↓
ตรวจ asset_no / serial_no ซ้ำ ถ้ามีการเปลี่ยน
   ↓
Update items
   ↓
บันทึก updated_by, updated_at
   ↓
บันทึก audit_logs
   ↓
Redirect กลับหน้า Detail
```

### 11.6 Soft Delete Flow

```text
User กดลบ
   ↓
Confirm Modal
   ↓
Server Action ตรวจ Role
   ↓
ถ้าเป็น Admin → update deleted_at = now()
   ↓
บันทึก deleted_by
   ↓
บันทึก audit_logs
   ↓
ซ่อนจากหน้า List ปกติ
```

### 11.7 Export Flow

```text
User เลือก Filter
   ↓
กด Export Excel หรือ PDF
   ↓
Server รับค่า Filter
   ↓
Query ข้อมูลตาม Filter
   ↓
Generate File
   ↓
Download
   ↓
บันทึก audit_logs
```

---

## 12. Search and Filter Strategy

### 12.1 Search Fields

ระบบควรค้นหาได้จาก:

- ชื่อสิ่งของ
- เลขครุภัณฑ์
- Serial Number
- ยี่ห้อ
- รุ่น
- ผู้รับผิดชอบ
- สถานที่

### 12.2 Filter Fields

ระบบควรกรองได้จาก:

- ประเภท
- หมวดหมู่
- สถานที่
- สถานะ

### 12.3 Pagination

ต้องใช้ Pagination เสมอในหน้า Items List

ตัวอย่าง:

```text
page = 1
limit = 20
offset = (page - 1) * limit
```

---

## 13. Storage Architecture

### 13.1 Bucket

ใช้ Supabase Storage bucket:

```text
item-images
```

### 13.2 File Path Pattern

```text
item-images/
  items/
    {item_id}/
      main.jpg
```

หรือกรณีรองรับหลายรูปในอนาคต:

```text
item-images/
  items/
    {item_id}/
      2026-06-25-xxxxx.webp
```

### 13.3 Image Upload Rule

- อนุญาตเฉพาะ jpg, png, webp
- จำกัดขนาดไฟล์ เช่น ไม่เกิน 3MB
- ตั้งชื่อไฟล์ใหม่เอง
- ไม่ใช้ชื่อไฟล์จาก user ตรง ๆ
- แสดง preview ก่อนบันทึก
- ถ้าเปลี่ยนรูป ควรลบรูปเก่าหรือแทนที่อย่างเป็นระบบ

---

## 14. Security Best Practices

### 14.1 Authentication

- ใช้ Supabase Auth
- ทุกหน้าหลัง Login ต้องตรวจ Session
- ถ้าไม่มี Session ให้ Redirect ไป Login

### 14.2 Authorization

- ตรวจ Role ใน UI เพื่อซ่อน/แสดงปุ่ม
- ตรวจ Role ใน Server Action อีกชั้น
- ใช้ RLS Policy ใน Supabase

### 14.3 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

ข้อสำคัญ:

- `NEXT_PUBLIC_*` ใช้ฝั่ง Client ได้
- `SUPABASE_SERVICE_ROLE_KEY` ห้ามออก Client เด็ดขาด
- ห้าม Commit `.env` ขึ้น GitHub

### 14.4 Data Protection

- Validate ข้อมูลทั้ง Client และ Server
- ใช้ Soft Delete
- ไม่แสดง Raw Database Error ให้ User
- บันทึก Audit Log ใน Action สำคัญ
- จำกัด File Upload
- ตรวจข้อมูลซ้ำก่อน Insert/Update

---

## 15. RLS Policy Concept

### 15.1 Policy Overview

```text
Authenticated User:
- อ่านข้อมูลที่ยังไม่ถูก deleted ได้

Admin:
- อ่าน เพิ่ม แก้ไข soft delete ได้
- จัดการ settings ได้

Staff:
- อ่าน เพิ่ม แก้ไขได้
- ไม่สามารถ soft delete
- ไม่สามารถจัดการ settings สำคัญ

Viewer:
- อ่านอย่างเดียว
```

### 15.2 Example Policy Concept

```sql
create policy "authenticated users can read active items"
on items for select
to authenticated
using (deleted_at is null);
```

```sql
create policy "admin and staff can insert items"
on items for insert
to authenticated
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'staff')
    and profiles.is_active = true
  )
);
```

```sql
create policy "admin and staff can update items"
on items for update
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'staff')
    and profiles.is_active = true
  )
);
```

---

## 16. UI/UX Design Guide

### 16.1 Design Style

- เรียบง่าย
- เป็นทางการ
- ไม่รก
- ใช้สีเท่าที่จำเป็น
- ใช้ Badge แสดงสถานะ
- Table ต้องอ่านง่าย
- Form ต้องแบ่ง Section ชัดเจน
- ไม่ใช้ Animation เยอะ
- รองรับ Mobile และ Desktop

### 16.2 Main Layout

```text
┌────────────────────────────────────┐
│ Topbar: Search / User Menu          │
├──────────────┬─────────────────────┤
│ Sidebar      │ Content Area         │
│ - Dashboard  │                     │
│ - Items      │                     │
│ - Reports    │                     │
│ - Settings   │                     │
└──────────────┴─────────────────────┘
```

### 16.3 Dashboard Cards

ควรมี Card ดังนี้:

- จำนวนสิ่งของทั้งหมด
- จำนวนวัสดุ
- จำนวนครุภัณฑ์
- จำนวนอุปกรณ์ทั่วไป
- จำนวนชำรุด/รอซ่อม
- รายการเพิ่มล่าสุด

### 16.4 Items Table Columns

- ชื่อสิ่งของ
- ประเภท
- หมวดหมู่
- จำนวน
- สถานที่
- ผู้รับผิดชอบ
- สถานะ
- วันที่แก้ไขล่าสุด
- Action

### 16.5 Item Form Sections

1. ข้อมูลทั่วไป
   - ชื่อสิ่งของ
   - ประเภท
   - หมวดหมู่
   - จำนวน
   - หน่วยนับ

2. ข้อมูลครุภัณฑ์ ถ้ามี
   - เลขครุภัณฑ์
   - Serial Number
   - ยี่ห้อ
   - รุ่น

3. สถานที่และผู้รับผิดชอบ
   - สถานที่
   - ผู้รับผิดชอบ

4. สถานะและหมายเหตุ
   - สถานะ
   - หมายเหตุ

5. รูปภาพ
   - Upload รูปภาพ
   - Preview รูปภาพ

---

## 17. Performance Best Practices

- ใช้ Server Components สำหรับหน้าอ่านข้อมูล
- ใช้ Client Components เฉพาะ Form, Table Controls, Upload
- ใช้ Pagination ในหน้า List
- ไม่โหลดข้อมูลทั้งหมดทีเดียว
- ใช้ Index กับ Field ที่ Search/Filter บ่อย
- ใช้ Dynamic Import สำหรับฟีเจอร์หนัก เช่น Export PDF
- จำกัดขนาดรูปภาพ
- ใช้ Next/Image สำหรับแสดงรูป
- หลีกเลี่ยง State ที่ไม่จำเป็น
- หลีกเลี่ยง Animation ที่หนัก
- Query เฉพาะ Column ที่จำเป็น

---

## 18. Error Handling

### 18.1 Expected Error

ตัวอย่าง:

- กรอกข้อมูลไม่ครบ
- เลขครุภัณฑ์ซ้ำ
- Serial Number ซ้ำ
- ไม่มีสิทธิ์แก้ไข

แนวทาง:

```text
Server Action return field error
   ↓
Form แสดง Error ใต้ Field
   ↓
ไม่ Redirect
```

### 18.2 Unexpected Error

ตัวอย่าง:

- Database Error
- Network Error
- Storage Upload Fail

แนวทาง:

```text
Catch Error
   ↓
Log Error
   ↓
แสดงข้อความทั่วไป:
“ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง”
```

ห้ามแสดง Raw Error จาก Database ให้ User เห็น

---

## 19. Deployment Architecture

### 19.1 Deployment Flow

```text
Developer Push Code to GitHub
   ↓
Vercel Detect Commit
   ↓
Vercel Build
   ↓
Deploy Preview / Production
   ↓
Connect Supabase Cloud
```

### 19.2 Environments

ควรแยก Environment:

```text
Local Development
Preview
Production
```

### 19.3 Production Checklist

- ตั้งค่า Environment Variables บน Vercel
- ตั้งค่า Supabase URL และ Anon Key
- ตั้งค่า Service Role Key เฉพาะฝั่ง Server
- เปิด RLS Policy
- ตั้งค่า Storage Bucket
- ตั้งค่า Redirect URL สำหรับ Auth
- ทดสอบ Login
- ทดสอบ CRUD
- ทดสอบ Upload
- ทดสอบ Export

---

## 20. Development Phases

## Phase 0: Requirement Lock

### เป้าหมาย

ล็อก Scope ก่อนเริ่มเขียน Code เพื่อไม่ให้ระบบบานปลาย

### สิ่งที่ต้องยืนยัน

- ระบบเป็นทะเบียนสิ่งของเท่านั้น
- ไม่มีรับเข้า
- ไม่มีเบิกออก
- ไม่มี Stock Movement
- ไม่มีอนุมัติ
- ไม่มี Workflow ซับซ้อน
- ใช้ Cloud 100%
- ใช้ Next.js + Supabase + Vercel
- มี Role: Admin, Staff, Viewer

### Deliverables

- Requirement Summary
- Scope Confirmation
- Architecture Summary
- Phase Plan

### Acceptance Criteria

- Scope ชัดเจน
- Agent เข้าใจข้อห้าม
- ยังไม่เริ่มเขียน Code ถ้ายังไม่ Approve

---

## Phase 1: Foundation Setup

### เป้าหมาย

สร้างฐานของระบบให้พร้อมพัฒนาต่อ

### งานที่ต้องทำ

- สร้าง Next.js Project
- ตั้งค่า TypeScript
- ตั้งค่า Tailwind CSS
- ติดตั้ง shadcn/ui
- สร้าง Layout หลัก
- สร้าง Sidebar
- สร้าง Route หลัก
- ตั้งค่า Supabase Client
- เตรียม Environment Variables
- สร้าง Database Migration
- Seed ข้อมูลเริ่มต้น

### หน้าที่ควรมีใน Phase นี้

- `/login`
- `/dashboard`
- `/items`
- `/items/new`
- `/reports`
- `/settings`

### Deliverables

- Project Structure
- Basic Layout
- Supabase Config
- SQL Migration
- Seed Data
- Placeholder Pages

### Acceptance Criteria

- รัน Project ได้
- เปิดหน้า Dashboard ได้
- มี Sidebar Navigation
- เชื่อม Supabase ได้
- มี Migration สำหรับตารางหลัก

---

## Phase 2: Item Core CRUD

### เป้าหมาย

ทำระบบจัดการรายการสิ่งของให้ใช้งานได้จริง

### งานที่ต้องทำ

- หน้า Items List
- หน้า Create Item
- หน้า Edit Item
- หน้า Item Detail
- Server Actions สำหรับ Create/Update/Soft Delete
- Query สำหรับ List/Detail
- Zod Schema
- Form Validation
- Search
- Filter
- Pagination
- Soft Delete

### ข้อมูลที่ต้องรองรับ

- ชื่อสิ่งของ
- ประเภท
- หมวดหมู่
- จำนวน
- หน่วยนับ
- เลขครุภัณฑ์
- Serial Number
- ยี่ห้อ
- รุ่น
- สถานที่
- ผู้รับผิดชอบ
- สถานะ
- หมายเหตุ

### Deliverables

- CRUD ทำงานได้
- Search/Filter ใช้งานได้
- Pagination ใช้งานได้
- Soft Delete ใช้งานได้
- Validation ครบ

### Acceptance Criteria

- เพิ่มรายการได้
- แก้ไขรายการได้
- ดูรายละเอียดได้
- ลบแบบ Soft Delete ได้
- ค้นหาได้
- กรองข้อมูลได้
- ข้อมูลซ้ำถูกป้องกัน

---

## Phase 3: Settings Management

### เป้าหมาย

ให้ Admin จัดการข้อมูลพื้นฐานได้

### งานที่ต้องทำ

- จัดการ Categories
- จัดการ Locations
- จัดการ Units
- แสดงข้อมูลเหล่านี้ใน Form Items
- ป้องกันลบข้อมูลที่ถูกใช้งานอยู่
- ใช้ is_active แทนการลบจริง

### Deliverables

- Settings Page
- Category Management
- Location Management
- Unit Management

### Acceptance Criteria

- Admin เพิ่ม/แก้ไข Category ได้
- Admin เพิ่ม/แก้ไข Location ได้
- Admin เพิ่ม/แก้ไข Unit ได้
- Form Item ดึงข้อมูลจาก Settings ได้

---

## Phase 4: Auth and Permission

### เป้าหมาย

ทำระบบ Login และควบคุมสิทธิ์ผู้ใช้

### งานที่ต้องทำ

- Supabase Auth
- Login/Logout
- Profile Table
- Role Guard
- Middleware
- Permission Check ใน Server Actions
- Hide/Show ปุ่มตาม Role
- RLS Policy

### Deliverables

- Login System
- Profile Management
- Role-based Permission
- RLS Policy

### Acceptance Criteria

- Viewer ดูอย่างเดียว
- Staff เพิ่มและแก้ไขได้
- Admin จัดการได้ทั้งหมด
- User ที่ไม่ Login เข้าไม่ได้
- Server Actions ตรวจ Permission ทุกครั้ง

---

## Phase 5: Image Upload

### เป้าหมาย

ให้สามารถแนบรูปภาพสิ่งของได้

### งานที่ต้องทำ

- สร้าง Supabase Storage Bucket
- Upload รูปภาพ
- Preview รูป
- Validate File Type
- Validate File Size
- Save image_url ลง Database
- Replace Image
- แสดงรูปใน Item Detail

### Deliverables

- Image Upload Component
- Storage Policy
- Image Preview
- Image Display

### Acceptance Criteria

- Upload รูปได้
- แสดงรูปได้
- จำกัดไฟล์เฉพาะ jpg/png/webp
- จำกัดขนาดไฟล์
- เปลี่ยนรูปได้

---

## Phase 6: Reports and Export

### เป้าหมาย

Export รายงานรายการสิ่งของได้

### งานที่ต้องทำ

- Export Excel
- Export PDF
- Export ตาม Filter ปัจจุบัน
- รายงานตามประเภท
- รายงานตามสถานที่
- รายงานตามสถานะ
- บันทึก Audit Log ตอน Export

### Deliverables

- Excel Export
- PDF Export
- Report Page

### Acceptance Criteria

- Export รายการทั้งหมดได้
- Export ตาม Filter ได้
- ไฟล์อ่านง่าย
- ใช้รายงานต่อได้จริง

---

## Phase 7: Polish, QA and Deployment

### เป้าหมาย

เก็บงานให้พร้อมใช้งานจริง

### งานที่ต้องทำ

- Loading State
- Empty State
- Error State
- Responsive Design
- Accessibility Basic Check
- Performance Check
- Security Check
- Bug Fix
- Deploy Vercel
- ตั้งค่า Supabase Production

### Deliverables

- Production-ready App
- Deployment Config
- QA Checklist
- Known Issues
- User Guide เบื้องต้น

### Acceptance Criteria

- ใช้งานได้จริง
- Deploy สำเร็จ
- Login ได้
- CRUD ได้
- Upload ได้
- Export ได้
- Permission ถูกต้อง
- ไม่มี Error สำคัญ

---

## 21. Agent Working Rules

### 21.1 General Rules

Agent ต้องทำงานทีละ Phase เท่านั้น  
ห้ามข้าม Phase  
ห้ามเพิ่ม Feature นอก Scope  
ห้ามทำระบบคลังเต็มรูปแบบ  
ห้ามทำ Workflow ที่ไม่ได้ระบุ

### 21.2 After Each Phase Agent Must Report

หลังจบแต่ละ Phase ต้องสรุป:

- ทำอะไรไปแล้ว
- สร้างไฟล์อะไร
- แก้ไขไฟล์อะไร
- วิธีทดสอบ
- Known Issues
- สิ่งที่ต้องทำ Phase ต่อไป

### 21.3 Approval Gate

ก่อนเริ่ม Phase ถัดไป ต้องให้ผู้ใช้ Approve ก่อน

ตัวอย่าง:

```text
Phase 1 เสร็จแล้ว กรุณาตรวจสอบ
ถ้า Approve จะเริ่ม Phase 2: Item Core CRUD
```

---

## 22. Master Prompt for Agent

```text
คุณคือ Senior Full-stack Developer, System Architect และ Security-aware Engineer

ช่วยออกแบบและพัฒนาระบบ “ระบบทะเบียนสิ่งของสำนักงาน” หรือ Office Item Registry System

ระบบนี้ใช้สำหรับบันทึกว่า “ในสำนักงานมีสิ่งของอะไรอยู่บ้าง” โดยเก็บข้อมูลชื่อสิ่งของ ประเภท หมวดหมู่ จำนวน หน่วยนับ เลขครุภัณฑ์ Serial Number ยี่ห้อ รุ่น สถานที่จัดเก็บ ผู้รับผิดชอบ สถานะ หมายเหตุ และรูปภาพ

ระบบนี้เป็นระบบทะเบียนสิ่งของแบบเรียบง่าย ไม่ใช่ระบบคลังพัสดุเต็มรูปแบบ

ห้ามทำ:
- ระบบรับเข้า
- ระบบเบิกออก
- ระบบตัด stock
- stock movement
- ระบบอนุมัติ
- ระบบยืม-คืน
- ระบบซ่อมบำรุงเต็มรูปแบบ
- workflow ซับซ้อน
- ระบบใหญ่เกินความจำเป็น

Tech Stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- React Hook Form
- Zod
- TanStack Table
- ExcelJS
- pdfmake หรือ jsPDF
- Deploy บน Vercel
- Cloud 100%

Architecture:
User Browser
→ Vercel / Next.js App
→ Next.js App Router
→ Server Components / Server Actions
→ Supabase Auth
→ Supabase PostgreSQL
→ Supabase Storage
→ Row Level Security

ให้ทำงานแบบแบ่ง Phase:
Phase 0: Requirement Lock
Phase 1: Foundation Setup
Phase 2: Item Core CRUD
Phase 3: Settings Management
Phase 4: Auth and Permission
Phase 5: Image Upload
Phase 6: Reports and Export
Phase 7: Polish, QA and Deployment

ให้ทำทีละ Phase เท่านั้น
หลังจบแต่ละ Phase ให้สรุป:
- ทำอะไรไปแล้ว
- สร้างไฟล์อะไร
- แก้ไขไฟล์อะไร
- วิธีทดสอบ
- Known Issues
- สิ่งที่ต้องทำต่อ

ก่อนเขียน Code ให้สรุป Architecture, Database Schema, Folder Structure และ Flow ให้ตรวจสอบก่อน
เมื่อได้รับ Approve แล้วจึงเริ่ม Phase 1
```

---

## 23. First Command to Agent

ใช้คำสั่งนี้หลังส่ง Master Prompt:

```text
เริ่มจาก Phase 0 และ Phase 1 เท่านั้น

ห้ามทำ Phase 2 ขึ้นไป
ห้ามเพิ่มระบบรับเข้า/เบิกออก/ยืมคืน/อนุมัติ

ก่อนเขียน code ให้สรุป:
1. Architecture
2. Database Schema
3. Folder Structure
4. Main Flow
5. Phase 1 Task List

เมื่อฉัน approve แล้วค่อยเริ่มแก้ code
```

---

## 24. Final Summary

ระบบนี้ควรวางเป็น:

```text
Simple Cloud Item Registry
```

ไม่ใช่:

```text
Full Inventory / Warehouse / Procurement System
```

แนวทางที่ถูกต้องคือ:

- ทำให้เล็กก่อน
- เร็วก่อน
- ค้นหาได้ก่อน
- ข้อมูลเป็นระเบียบก่อน
- มีสิทธิ์ผู้ใช้พื้นฐาน
- Export ได้
- Deploy ง่าย
- Cloud 100%

สิ่งที่สำคัญที่สุดคือห้ามปล่อยให้ Agent เพิ่ม Feature เกิน Scope เพราะระบบจะบานและดูแลยาก
