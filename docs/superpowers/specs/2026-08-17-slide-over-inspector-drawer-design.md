# Slide-Over Detail Drawer (Inspector Sheet) Design Specification

## 1. Overview & Problem Statement
In the current Items Explorer (`app/(dashboard)/items/items-explorer-client.tsx`), the Item Inspector panel occupies a fixed right column (`360px–400px`), squeezing the main table to ~60% width and causing text truncation or horizontal overflow on 1080p desktop and laptop screens.

This specification redesigns the Inspector into a **Slide-Over Detail Drawer (Modal Sheet / Overlay)**, inspired by Notion and Linear. The main table remains 100% full-width at all times, with zero horizontal compression. When an item is clicked, a polished drawer slides in smoothly from the right edge.

---

## 2. Visual Architecture & Interaction Flow

```text
┌─────────────────────────────────────────────────────────────┬───────────────────────────┐
│ 🏷️ รายการทะเบียนสิ่งของและครุภัณฑ์                           │ 📑 รายละเอียดครุภัณฑ์  [X] │
│ [ ค้นหาชื่อ, เลขครุภัณฑ์, Serial... ]  [ หมวดหมู่ ] [ สถานะ ] │ ───────────────────────── │
│ ─────────────────────────────────────────────────────────── │ [ รูปภาพพัสดุ Zoomable ]   │
│ ชื่อรายการ      │ เลขครุภัณฑ์  │ หมวดหมู่ │ สถานที่  │ ราคา     │ • เลขครุภัณฑ์: EQ-2026-01 │
│ โน้ตบุ๊ก Dell XPS│ EQ-2026-001 │ ไอที     │ ชั้น 3   │ ฿45,000 │ • Serial No: CN-994821    │
│ จอภาพ LG 27"   │ EQ-2026-002 │ ไอที     │ ชั้น 3   │ ฿8,500  │ • ผู้รับผิดชอบ: นาย ก     │
│ โต๊ะทำงานไม้สัก │ EQ-2026-003 │ เฟอร์นิเจอร์│ ชั้น 2   │ ฿12,000 │ • สถานที่: ห้องประชุม 1   │
│ เก้าอี้ Ergonomic│ EQ-2026-004 │ เฟอร์นิเจอร์│ ชั้น 2   │ ฿6,900  │ [ ✏️ แก้ไข ] [ 🖨️ ป้าย ]  │
└─────────────────────────────────────────────────────────────┴───────────────────────────┘
▲ ตารางกว้างเต็ม 100% (Zero Layout Shift)                      ▲ Slide-over Sheet (440px)
```

---

## 3. Detailed Component Specifications

### 3.1 Main Container (`app/(dashboard)/items/items-explorer-client.tsx`)
- `<main>` occupies `w-full flex-1 flex flex-col min-w-0 overflow-hidden`.
- Row selection behavior:
  - **Single Click on row / "ดูรายละเอียด":** Sets `inspectorItemId = item.id`, opening the Slide-Over Drawer.
  - **Checkbox Click:** Toggles bulk selection without opening the drawer.
  - **Double Click:** Navigates directly to full detail page `/items/[id]`.

### 3.2 Slide-Over Inspector Sheet Component
- **Container Structure**:
  - **Backdrop**: `fixed inset-0 z-50 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200` (clicking backdrop closes drawer).
  - **Drawer Panel**: `fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-250 flex flex-col overflow-hidden`.
- **Header**:
  - Item title & category badge.
  - Close button (`X`) with accessible `aria-label="ปิดแถบรายละเอียด"`.
  - Keyboard shortcut: `Escape` key closes the drawer immediately.
- **Body Content (Scrollable)**:
  - High-resolution Zoomable Image preview (or placeholder).
  - Key-value metadata cards (Asset No, Serial No, Brand, Model, Responsible Person, Location, Unit Price, Total Quantity).
  - Quick action toolbar:
    - `[✏️ แก้ไขข้อมูล]` (Edit item modal / page)
    - `[🖨️ พิมพ์ป้ายบาร์โค้ด]` (Asset tag label modal trigger)
    - `[🗑️ ย้ายไปถังขยะ]` (Delete item with confirmation)
    - `[🔗 ดูหน้ารายละเอียดเต็ม]` (Navigate to `/items/[id]`)
- **Admin Audit Trail**:
  - Timeline of recent mutations and audit logs for admins.

---

## 4. Performance, Accessibility & Responsive Behavior
- **Zero CLS (Cumulative Layout Shift):** Opening/closing the drawer uses fixed overlay positioning, ensuring the table never reflows or jumps.
- **Mobile (< 768px):** Drawer adapts to full-screen sheet (`w-full max-w-full`).
- **Keyboard Navigation:** Tab focus is trapped within the drawer while open, and focus returns to the triggering row upon closing.
- **State Persistence:** Preserves active filters and pagination while inspecting items.

---

## 5. Verification & Testing
- Unit tests in `tests/component/items-explorer.test.tsx` verifying:
  - Table remains 100% full-width.
  - Clicking a row opens the slide-over drawer with correct item details.
  - Clicking the close button or pressing `Escape` closes the drawer.
- Full suite verification with `npm test`, `npm run typecheck`, and `npm run lint`.
