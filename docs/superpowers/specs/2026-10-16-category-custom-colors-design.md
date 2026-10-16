# Design Specification: Category Custom Color Wheel & Registry Visual Indicator

**Status:** Approved / Ready for Implementation  
**Date:** 2026-10-16 (Updated)  
**Topic:** หมวดหมู่พัสดุ — การเลือกสีประจำหมวดหมู่ด้วยวงล้อสี (RGB/HEX Color Wheel) และการแสดงผลบนตารางทะเบียนพัสดุ (`/items`)  
**Target Files:**
- `db/migrations/00042_add_color_to_categories.sql` (New Migration)
- `db/postgres/schema.ts` (Drizzle ORM schema update)
- `features/settings/schema.ts` (Zod validation for strict `#RRGGBB` 6-digit hex and p1reprocessing)
- `features/settings/types.ts` (`CategoryRow` color field)
- `features/settings/actions.ts` & `features/settings/postgres-actions.ts` (CRUD update for color and `/items` cache revalidation)
- `features/settings/components/category-color-picker.tsx` (New Component: Radix Popover + Color Wheel & Swatches)
- `features/settings/components/metadata-sections.tsx` (Integrate Color Picker into Category form)
- `features/items/types.ts` (`ReferenceOption` color field)
- `features/items/queries.ts` (Select `id, name, color` in Supabase cache & hydration)
- `features/items/postgres-queries.ts` (Select `c.color` in `itemListColumns`, `itemBatchColumns`, and `getPostgresItemReferences`)
- `features/items/components/category-badge.tsx` (New Component: SSR/Theme-safe accessible badge with `color-mix` & `max-w-full`)
- `features/items/components/items-list-view.tsx` (Widen category column to `w-44` and render `CategoryBadge`)
- `features/items/components/items-grid-view.tsx` (Category badge in card layout)
- `features/items/components/item-inspector-drawer.tsx` (Category badge in Inspector panel)

---

## 1. Executive Summary & Intent

### 1.1 วัตถุประสงค์ (Intent)
ระบบ CAMMS มีรายการพัสดุและครุภัณฑ์จำนวนมากที่สังกัดในหมวดหมู่ที่แตกต่างกัน (เช่น ครุภัณฑ์สำนักงาน, ครุภัณฑ์คอมพิวเตอร์, ยานพาหนะ, วัสดุสิ้นเปลือง ฯลฯ)  
ผู้ใช้งาน (เจ้าหน้าที่พัสดุและผู้ดูแลระบบ) ต้องการ:
1. **กำหนดสีประจำหมวดหมู่ได้เอง** ผ่านหน้าตั้งค่าหมวดหมู่พัสดุ (`/settings?tab=categories`) โดยมีปุ่มกดเปิดวงล้อสี RGB / Color Picker เพื่อเลือกเฉดสีที่ต้องการหรือใส่รหัสสี HEX 6 หลักได้
2. **แสดงผลสีประจำหมวดหมู่บนตารางทะเบียนพัสดุ (`/items`)** เพื่อให้สามารถกวาดสายตา (Eye-scanning) แยกแยะหมวดหมู่ของสิ่งของแต่ละรายการได้อย่างรวดเร็ว

### 1.2 ข้อกำหนดและกรอบการออกแบบตามมาตรฐาน CAMMS
- **Accessibility & Hard Rule:** อ้างอิงตาม `PRODUCT.md` และ `AGENTS.md`:  
  > `❌ NEVER add color-only labels (always text + icon alongside color)`  
  ห้ามแสดงเพียงจุดสีหรือแถบสีลอยๆ โดยไม่มีข้อความและไอคอนกำกับ ต้องแสดงเป็น Tag/Badge ที่มีทั้งชื่อหมวดหมู่และสีประจำหมวดหมู่เสมอ
- **Dual-Theme Support (Light / Dark Mode) & SSR Safety:**  
  - ห้ามใช้ JavaScript Runtime Theme Detection (`isDark` check) เพื่อป้องกันปัญหา **SSR Hydration Mismatch**
  - ใช้สีตัวอักษรเป็น `text-foreground` เสมอ เพื่อให้อ่านออกได้ชัดเจน 100% ทั้ง Light และ Dark Mode
  - ใช้ CSS `color-mix(in oklab, ${safeColor} 75%, var(--foreground))` สำหรับสีไอคอน Tag
  - พื้นหลังใช้ Alpha Transparency Hex 10% (`${safeColor}1A`) และเส้นขอบ 30% (`${safeColor}4D`)
- **Strict HEX Format (`#RRGGBB`):** บังคับใช้รูปแบบ 6 หลักเท่านั้น ไม่อนุญาต 3 หลัก (`#RGB`) เพื่อป้องกันข้อผิดพลาดเวลาต่อท้ายด้วย Hex Alpha ใน CSS (เช่น `#ABC1A` จะกลายเป็น 5 หลักซึ่งเป็น Invalid CSS color)

---

## 2. โครงสร้างฐานข้อมูลและการจัดการ Schema (Database & Types)

### 2.1 Database Migration (`db/migrations/00042_add_color_to_categories.sql`)

```sql
-- Migration: 00042_add_color_to_categories.sql
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#64748B';

-- Comment อธิบายคอลัมน์
COMMENT ON COLUMN public.categories.color IS 'HEX 6-digit color code for category badge (e.g. #3B82F6)';
```

### 2.2 Drizzle ORM Schema (`db/postgres/schema.ts`)

```typescript
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  description: text(),
  color: text().notNull().default('#64748B'), // ตรงกับ NOT NULL DEFAULT ใน SQL Migration
  is_active: boolean().notNull().default(true),
  ...stamps(),
})
```

### 2.3 TypeScript Types Alignment

1. **`features/settings/types.ts`:**
```typescript
export interface CategoryRow {
  id: string
  name: string
  description: string | null
  color: string // NOT NULL จากฐานข้อมูล (มี fallback เสมอ)
  is_active: boolean
  updated_at: string
}
```

2. **`features/items/types.ts`:**
```typescript
export interface ReferenceOption {
  id: string
  name: string
  color?: string // รองรับฟิลด์สีประจำหมวดหมู่
}
```

---

## 3. Zod Validation & Server Actions

### 3.1 Zod Schema ใน `features/settings/schema.ts`

- บังคับใช้ Regex ตรวจสอบ HEX 6 หลักเท่านั้น (`/^#[0-9A-Fa-f]{6}$/`)
- ใช้ `z.preprocess()` เพื่อแปลงค่าว่าง (`""`) จาก `formData.get('color')` เป็น `undefined` เพื่อให้ `.default('#64748B')` ทำงานอย่างถูกต้อง และแปลงสตริงเป็นตัวพิมพ์ใหญ่ `.toUpperCase()`:

```typescript
// บังคับ HEX 6 หลักเท่านั้น (#RRGGBB)
const hex6ColorRegex = /^#[0-9A-Fa-f]{6}$/

export const categorySchema = z.object({
  name: requiredName,
  description: optionalText,
  color: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim()
        return trimmed === '' ? undefined : trimmed.toUpperCase()
      }
      return val
    },
    z
      .string()
      .regex(hex6ColorRegex, 'รหัสสีไม่ถูกต้อง (ต้องอยู่ในรูปแบบ HEX 6 หลัก เช่น #3B82F6)')
      .default('#64748B')
  ),
  is_active: checkboxBoolean,
})
```

### 3.2 Server Actions & Cache Invalidation

ใน `features/settings/actions.ts` และ `features/settings/postgres-actions.ts`:
- รับค่า `color: formData.get('color')` เข้าสู่ `categorySchema.safeParse(...)`
- บันทึกการเปลี่ยนแปลงลง `categories` และ Audit Log
- **Cache Revalidation:** ต้องเรียก `revalidatePath('/items')` เพิ่มเติมจากการล้างแคชเดิม เพื่อให้ตารางทะเบียนพัสดุอัปเดตสีใหม่ทันที:

```typescript
// features/settings/actions.ts
function revalidateSettings() {
  revalidateTag(CACHE_TAGS.categories)
  revalidatePath('/settings')
  revalidatePath('/items')          // <<-- เพิ่ม revalidate ตารางทะเบียนพัสดุ
  revalidatePath('/', 'layout')
}
```

---

## 4. Query Layer & Projection Updates

เพื่อให้สีถูกส่งต่อไปยังหน้ารายการพัสดุ (`/items`) อย่างสมบูรณ์ทั้งสองโหมดฐานข้อมูล (Supabase & Standalone Postgres):

### 4.1 ฝั่ง Supabase (`features/items/queries.ts`)

1. **`getCachedItemReferences`:**
   ```typescript
   const [categories, locations, units] = await Promise.all([
     supabase.from('categories').select('id, name, color').eq('is_active', true).order('name'),
     supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
     supabase.from('units').select('id, name').eq('is_active', true).order('name'),
   ])
   ```
2. **Item Hydration (`getItems`, `getItemBatch`, `getItemById`):**
   การ hydrate ใช้ `catMap.get(row.category_id)` ซึ่ง `catMap` ดึงมาจาก `references.categories` ที่มี `{ id, name, color }` อยู่แล้ว ทำให้ `row.category` ได้รับ `color` โดยอัตโนมัติ

### 4.2 ฝั่ง Standalone Postgres (`features/items/postgres-queries.ts`)

1. **`getPostgresItemReferences`:**
   ```typescript
   const categories = await tx.execute<ReferenceOption & Record<string, unknown>>(
     sql`select id, name, color from public.categories where is_active order by name`
   )
   ```
2. **`itemListColumns` & `itemBatchColumns`:**
   อัปเดต SQL fragment การ build JSON object สำหรับ category ให้มี `color` ด้วย:
   ```typescript
   export const itemListColumns = sql`i.id, i.item_name, i.item_type, i.quantity, i.unit_price,
     i.asset_no, i.serial_no, i.responsible_person, i.status, i.updated_at,
     i.brand, i.model,
     case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'color', c.color) end as category,
     case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as unit,
     case when l.id is null then null else json_build_object('id', l.id, 'name', l.name) end as location`
   ```

---

## 5. รายละเอียดส่วนติดต่อผู้ใช้ (UI Components)

### 5.1 `CategoryColorPicker` (`features/settings/components/category-color-picker.tsx`)

คอมโพเนนต์สำหรับเลือกสีในฟอร์มหมวดหมู่ (`features/settings/components/metadata-sections.tsx`):
- **Trigger Button:** แสดงสี่เหลี่ยม/วงกลมตัวอย่างสีปัจจุบัน + รหัส `#HEX` พร้อมลูกศร Dropdown
- **Popover Body (Radix Popover):**
  1. **Quick Swatches:** ชุดสีราชการ 16 เฉดสี (Slate, Red, Orange, Amber, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose, Stone)
  2. **RGB Wheel / Native Picker Integration:** คลิกเพื่อเปิดวงล้อสี RGB สำหรับปรับโทนสีอิสระ
  3. **Direct Hex Input:** ช่อง Input ให้พิมพ์รหัสสีโดยตรง (เช่น `#3B82F6`) พร้อม Auto-uppercase
  4. **Hidden Input:** `<input type="hidden" name="color" value={selectedColor} />` เชื่อมต่อเข้า Server Action อัตโนมัติ

### 5.2 `CategoryBadge` (`features/items/components/category-badge.tsx`)

คอมโพเนนต์แสดงผลป้ายหมวดหมู่ที่ออกแบบเพื่อความปลอดภัยในการเข้าถึง (Accessibility) และรองรับ SSR 100%:

```tsx
import React from 'react'
import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  name: string
  color?: string | null
  className?: string
}

const HEX_6_REGEX = /^#[0-9A-Fa-f]{6}$/
const DEFAULT_COLOR = '#64748B'

export const CategoryBadge = React.memo(function CategoryBadge({
  name,
  color,
  className,
}: CategoryBadgeProps) {
  // Regex validation fallback: ป้องกันกรณีข้อมูลผิดรูปแบบหรือ null
  const safeColor = color && HEX_6_REGEX.test(color) ? color : DEFAULT_COLOR

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0',
        className
      )}
      style={{
        backgroundColor: `${safeColor}1A`, // Alpha 10% (1A in hex)
        borderColor: `${safeColor}4D`,     // Alpha 30% (4D in hex)
      }}
      title={name}
    >
      {/* 1. จุดสีประจำหมวดหมู่ */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: safeColor }}
        aria-hidden="true"
      />
      
      {/* 2. ไอคอน Tag ใช้ color-mix เพื่อความชัดเจนในทุกธีมโดยไม่ต้องใช้ JS isDark */}
      <Tag
        className="w-3 h-3 shrink-0"
        style={{ color: `color-mix(in oklab, ${safeColor} 75%, var(--foreground))` }}
        aria-hidden="true"
      />

      {/* 3. ชื่อหมวดหมู่ภาษาไทย ใช้ text-foreground และ truncate รองรับ cell แคบ */}
      <span className="truncate text-foreground font-medium">
        {name}
      </span>
    </span>
  )
})
```

### 5.3 การปรับแต่งตารางรายการพัสดุ (`features/items/components/items-list-view.tsx`)

- **ขยายความกว้างคอลัมน์หมวดหมู่:** จาก `w-28` หรือ `w-36` เป็น **`w-44` (176px)** เพื่อรองรับชื่อหมวดหมู่ภาษาไทย (เช่น "ครุภัณฑ์คอมพิวเตอร์", "ครุภัณฑ์สำนักงาน") ร่วมกับจุดสีและไอคอนได้โดยไม่ถูกตัดทอนเร็วจนเกินไป
- **โค้ดที่ Table Header & Cell:**
  ```tsx
  {/* Header */}
  <DataTableHead className={cn("hidden w-44 px-3", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")}>
    หมวดหมู่
  </DataTableHead>

  {/* Body Row */}
  <DataTableCell 
    className={cn("hidden w-44 px-3 text-xs truncate", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")} 
    title={item.category?.name}
  >
    {item.category ? (
      <CategoryBadge 
        name={item.category.name} 
        color={item.category.color} 
      />
    ) : (
      <span className="text-muted-foreground">-</span>
    )}
  </DataTableCell>
  ```

---

## 6. แผนการทดสอบและการตรวจสอบ (Verification Plan)

| ขั้นตอนการตรวจสอบ | คำสั่ง / วิธีการ | เกณฑ์การผ่าน (Acceptance Criteria) |
|---|---|---|
| **1. Zod Schema Unit Tests** | `npm test features/settings/schema.test.ts` | ยอมรับ `#RRGGBB` 6 หลัก, แปลงตัวพิมพ์ใหญ่, ปฏิเสธ `#RGB` 3 หลัก และแปลง `""` เป็น Default `#64748B` |
| **2. Database Schema Check** | `npm run verify-db-release` | คอลัมน์ `color` ใน `categories` เป็น `VARCHAR(7) NOT NULL DEFAULT '#64748B'` |
| **3. Query Projection Check** | `npm test features/items/postgres-queries.test.ts` | คอลัมน์ `category` ใน Item Row ส่งคืน `{ id, name, color }` ครบถ้วน |
| **4. Component Render Test** | `npm test tests/component/category-badge.test.tsx` | เรนเดอร์จุดสี, ไอคอน `Tag`, ชื่อหมวดหมู่ พร้อม fallback เมื่อได้สีไม่ถูกต้อง |
| **5. Full Quality Gate** | `npm run typecheck && npm run lint` | TypeScript strict check ผ่าน 100% ไม่มี type mismatch หรือ error |

---

## 7. Next Step: Implementation Plan Handoff

เมื่อเอกสารสเปกฉบับนี้ได้รับความเห็นชอบแล้ว สามารถเรียกใช้ทักษะ **`writing-plans`** เพื่อสร้างไฟล์ `docs/superpowers/plans/YYYY-MM-DD-category-custom-colors.md` และเริ่มต้นพัฒนาตามลำดับ TDD ได้ทันที
