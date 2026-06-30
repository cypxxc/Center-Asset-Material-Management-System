# Trash System Design

## Goal

ทำให้ระบบ Trash (ถังขยะ) ใช้งานได้สมบูรณ์ — ผู้ใช้ที่มีสิทธิ์ (Admin และ Staff) สามารถดูรายการที่ถูก Soft Delete กู้คืน (Restore) หรือลบถาวร (Hard Delete) ผ่านหน้าเว็บได้โดยตรง แทนที่จะต้องไปใช้ DB Panel

## สิทธิ์การใช้งาน

| Role | ดูถังขยะ | Restore | Hard Delete |
|------|----------|---------|-------------|
| Admin | ✅ | ✅ | ✅ |
| Staff | ✅ | ✅ | ✅ |
| Viewer | ❌ ซ่อนเมนู | ❌ | ❌ |

## Architecture

- หน้า `/items?deleted=true` จะแสดง **TrashExplorerClient** แทน **ItemsExplorerClient**
- `page.tsx` ของ `/items` ตรวจ `params.deleted === 'true'` และ route ไปยัง component ที่ถูกต้อง
- Server Actions แยก: `restoreItem`, `bulkRestoreItems`, `hardDeleteItem`, `bulkHardDeleteItems`
- Query แยก: `getDeletedItems` ดึงเฉพาะรายการที่มี `deleted_at IS NOT NULL`

## Data Flow

```
User → Trash Link → /items?deleted=true
  → page.tsx (server) → getDeletedItems() → TrashExplorerClient
    → [Restore] → restoreItem(id) → deleted_at = null, deleted_by = null
    → [Hard Delete] → ConfirmDialog → hardDeleteItem(id) → DELETE FROM items
```

## UI Components

1. **TrashExplorerClient** — หน้าแสดงรายการ Soft Deleted คล้าย ItemsExplorerClient แต่:
   - มีคอลัมน์ "วันที่ลบ" แทน "สถานะ"
   - ปุ่ม Restore ต่อแถว (Admin + Staff)
   - ปุ่ม Hard Delete ต่อแถว (Admin + Staff) → เปิด Confirmation Dialog
   - Bulk Restore และ Bulk Hard Delete
2. **HardDeleteConfirmDialog** — Dialog ยืนยันการลบถาวร พร้อมข้อความเตือนว่าไม่สามารถกู้คืนได้

## การเปลี่ยนแปลงจากระบบเดิม

- `lib/permissions.ts`: เพิ่ม `canManageTrash()` — Admin และ Staff ทำได้
- `features/items/queries.ts`: เพิ่ม `getDeletedItems()`
- `features/items/actions.ts`: เพิ่ม 4 Server Actions สำหรับ Restore และ Hard Delete
- `app/(dashboard)/items/page.tsx`: ตรวจ `deleted` param และ route ไปยัง component ที่ถูกต้อง
- ไฟล์ใหม่: `app/(dashboard)/items/trash-explorer-client.tsx`
- `components/layout/sidebar.tsx`: แสดงเมนู Trash ให้ Staff เห็นด้วย
