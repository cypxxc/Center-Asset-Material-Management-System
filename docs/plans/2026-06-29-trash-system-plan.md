# Trash System (Full) Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** ทำให้หน้าถังขยะ `/items?deleted=true` ใช้งานได้จริง — แสดงรายการที่ถูก Soft Delete พร้อมปุ่ม Restore และ Hard Delete (พร้อม Confirmation Dialog)

**Architecture:** เพิ่ม permission helper `canManageTrash()`, query `getDeletedItems()`, 4 Server Actions สำหรับ Restore/HardDelete, สร้าง `TrashExplorerClient` component ใหม่, และแก้ `page.tsx` ให้ route ไปยัง component ที่ถูกต้องตาม `deleted` param

**Tech Stack:** Next.js 15 App Router, Supabase SSR Client, TypeScript, Lucide Icons, Tailwind CSS

---

### Task 1: เพิ่ม `canManageTrash` permission helper

**Files:**
- Modify: `lib/permissions.ts`

เพิ่ม function ใหม่ที่ท้ายไฟล์:

```typescript
export function canManageTrash(role?: string | null): boolean {
  return role === 'admin' || role === 'staff'
}
```

**Commit:**
```bash
git add lib/permissions.ts
git commit -m "feat(trash): add canManageTrash permission helper"
```

---

### Task 2: เพิ่ม `getDeletedItems` query

**Files:**
- Modify: `features/items/queries.ts`

เพิ่ม interface และ function ต่อไปนี้ **ต่อจากบรรทัด 263 (ท้ายไฟล์)**:

```typescript
export interface DeletedItemRow {
  id: string
  item_name: string
  item_type: ItemType
  quantity: number
  asset_no: string | null
  serial_no: string | null
  responsible_person: string | null
  status: ItemStatus
  deleted_at: string
  category: ReferenceOption | null
  unit: ReferenceOption | null
  location: ReferenceOption | null
}

export interface DeletedItemsResult {
  items: DeletedItemRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getDeletedItems(params: ItemListSearchParams): Promise<DeletedItemsResult> {
  const supabase = await createClient()
  const page = parsePage(params.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const q = params.q?.trim()

  let query = supabase
    .from('items')
    .select(
      `
        id,
        item_name,
        item_type,
        quantity,
        asset_no,
        serial_no,
        responsible_person,
        status,
        deleted_at,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `,
      { count: 'exact' }
    )
    .not('deleted_at', 'is', null)

  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(
      `item_name.ilike.%${safe}%,asset_no.ilike.%${safe}%,serial_no.ilike.%${safe}%,responsible_person.ilike.%${safe}%`
    )
  }

  if (params.type && (params.type === 'material' || params.type === 'asset' || params.type === 'general')) {
    query = query.eq('item_type', params.type)
  }

  const { data, count, error } = await query.order('deleted_at', { ascending: false }).range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const total = count ?? 0

  return {
    items: ((data ?? []) as (Omit<DeletedItemRow, 'category' | 'unit' | 'location'> & {
      category: ReferenceOption | ReferenceOption[] | null
      unit: ReferenceOption | ReferenceOption[] | null
      location: ReferenceOption | ReferenceOption[] | null
    })[]).map((row) => ({
      ...row,
      deleted_at: row.deleted_at as string,
      category: firstRelation(row.category),
      unit: firstRelation(row.unit),
      location: firstRelation(row.location),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}
```

**Commit:**
```bash
git add features/items/queries.ts
git commit -m "feat(trash): add getDeletedItems query"
```

---

### Task 3: เพิ่ม Server Actions สำหรับ Restore และ Hard Delete

**Files:**
- Modify: `features/items/actions.ts`

เพิ่ม 4 functions ต่อไปนี้ **ต่อจาก `bulkDeleteItems` (ประมาณบรรทัด 313)**:

```typescript
// ============================================================
// Trash: Restore & Hard Delete
// ============================================================

export async function restoreItem(id: string) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถกู้คืนรายการได้ กรุณาลองใหม่อีกครั้ง' }
  }

  revalidatePath('/items')
  return { ok: true, message: 'กู้คืนรายการเรียบร้อยแล้ว' }
}

export async function bulkRestoreItems(ids: string[]) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการกู้คืน' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถกู้คืนรายการได้: ' + error.message }
  }

  revalidatePath('/items')
  return { ok: true, message: `กู้คืนเรียบร้อย ${ids.length} รายการ` }
}

export async function hardDeleteItem(id: string) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  const supabase = await createClient()

  const { data: item } = await supabase
    .from('items')
    .select('image_url')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถลบรายการถาวรได้ กรุณาลองใหม่อีกครั้ง' }
  }

  if (item?.image_url) {
    await deleteOldImage(item.image_url)
  }

  revalidatePath('/items')
  return { ok: true, message: 'ลบรายการถาวรเรียบร้อยแล้ว' }
}

export async function bulkHardDeleteItems(ids: string[]) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการลบถาวร' }
  }

  const supabase = await createClient()

  const { data: items } = await supabase
    .from('items')
    .select('image_url')
    .in('id', ids)
    .not('deleted_at', 'is', null)

  const { error } = await supabase
    .from('items')
    .delete()
    .in('id', ids)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถลบรายการถาวรได้: ' + error.message }
  }

  if (items) {
    await Promise.allSettled(items.map((item) => deleteOldImage(item.image_url)))
  }

  revalidatePath('/items')
  return { ok: true, message: `ลบถาวรเรียบร้อย ${ids.length} รายการ` }
}
```

**Commit:**
```bash
git add features/items/actions.ts
git commit -m "feat(trash): add restore and hard-delete server actions"
```

---

### Task 4: สร้าง `TrashExplorerClient` component

**Files:**
- Create: `app/(dashboard)/items/trash-explorer-client.tsx`

สร้างไฟล์ใหม่ด้วยเนื้อหาต่อไปนี้ (ดูเนื้อหาเต็มในไฟล์ plan):

```tsx
'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Package, FileText, Folder,
  MapPin, RotateCcw, Search, Trash2, User,
} from 'lucide-react'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, ItemType } from '@/features/items/types'
import { DeletedItemRow } from '@/features/items/queries'
import {
  restoreItem, bulkRestoreItems,
  hardDeleteItem, bulkHardDeleteItems,
} from '@/features/items/actions'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ... (ดูโค้ดเต็มด้านล่าง)
```

**โค้ดเต็มของ TrashExplorerClient** — ดูในแผน task นี้ จะเห็น component ที่ประกอบด้วย:
1. `HardDeleteConfirmDialog` — Dialog ยืนยันการลบถาวร
2. `TrashExplorerClient` — Component หลักพร้อม Header Bar, Bulk Actions Bar, Table, Pagination

**Commit:**
```bash
git add app/(dashboard)/items/trash-explorer-client.tsx
git commit -m "feat(trash): add TrashExplorerClient component"
```

---

### Task 5: แก้ `items/page.tsx` ให้ route ไปยัง TrashExplorerClient

**Files:**
- Modify: `app/(dashboard)/items/page.tsx`

แทนที่เนื้อหาทั้งหมดด้วย:

```tsx
import { getItems, getItemReferences, getDeletedItems } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete, canManageTrash } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { TrashExplorerClient } from './trash-explorer-client'
import { redirect } from 'next/navigation'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const [params, profile, references] = await Promise.all([
    searchParams,
    getCurrentProfile(),
    getItemReferences()
  ])

  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)
  const userCanManageTrash = canManageTrash(profile?.role)

  if (params.deleted === 'true') {
    if (!userCanManageTrash) redirect('/items')

    const result = await getDeletedItems(params)
    return (
      <TrashExplorerClient
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        params={{ q: params.q, type: params.type, page: params.page }}
      />
    )
  }

  const result = await getItems(params)
  return (
    <ItemsExplorerClient
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      params={params}
      userCanWrite={userCanWrite}
      userCanDelete={userCanDelete}
      locations={references.locations}
      categories={references.categories}
    />
  )
}
```

**Commit:**
```bash
git add app/(dashboard)/items/page.tsx
git commit -m "feat(trash): route /items?deleted=true to TrashExplorerClient"
```

---

### Task 6: แก้ Sidebar ให้ Staff เห็นเมนู Trash

**Files:**
- Modify: `components/layout/sidebar.tsx`

หาบรรทัด 336 ที่มี `{isAdmin && (` ที่ครอบ Trash Link แล้วเปลี่ยนเป็น `{canWrite && (`:

```tsx
// เปลี่ยนจาก:
{isAdmin && (
  <Link href="/items?deleted=true"

// เป็น:
{canWrite && (
  <Link href="/items?deleted=true"
```

(ตัวแปร `canWrite = isAdmin || isStaff` มีอยู่แล้วที่บรรทัด 113)

**Commit:**
```bash
git add components/layout/sidebar.tsx
git commit -m "feat(trash): show trash link to staff as well as admin"
```

---

### Task 7: Verification

รัน dev server แล้วตรวจสอบ:

```bash
npm run dev
```

Checklist:
- [ ] Admin เห็นเมนู Trash
- [ ] Staff เห็นเมนู Trash
- [ ] Viewer ไม่เห็นเมนู Trash
- [ ] คลิก Trash → URL `/items?deleted=true` → เห็นหน้าถังขยะ
- [ ] รายการที่ Soft Deleted ปรากฏในถังขยะ
- [ ] กู้คืน (Restore) → รายการหายจากถังขยะ กลับไปหน้าหลัก
- [ ] Hard Delete → มี Dialog ยืนยัน → ยืนยัน → รายการหายถาวร
- [ ] Bulk Restore ทำงานได้
- [ ] Bulk Hard Delete มี Dialog ยืนยัน → ทำงานได้
