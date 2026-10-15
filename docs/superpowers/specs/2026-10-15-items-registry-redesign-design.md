# Design Specification: CAMMS Items Registry Impeccable UX/UI Redesign

**Status:** Proposed  
**Date:** 2026-10-15  
**Topic:** Redesign of Items Registry (`/items`) into an Impeccable Power-User Workspace  
**Target File(s):**
- `app/(dashboard)/items/items-explorer-client.tsx`
- `features/items/components/items-list-view.tsx`
- `features/items/components/item-inspector-drawer.tsx`
- `features/items/components/items-filter-bar.tsx` (new extracted component)
- `features/items/components/item-thumbnail.tsx` (new extracted component)
- `tests/component/items-explorer-inspector.test.tsx`
- `tests/component/items-filter-bar.test.tsx` (new test suite)

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
In CAMMS (Center Asset & Material Management System), the Items Explorer (`/items`) is the core daily workplace where Staff and Admins register, search, audit, inspect, batch edit, and print QR stickers for thousands of government office assets and materials.

### 1.2 Observed UX Friction in Current Implementation
1. **Modal Blocking Inspector:** When a user clicks an item row, the `Inspector` opens as a flyout drawer covered by a dark backdrop (`bg-black/40 backdrop-blur-xs`). This blocks the entire table behind it. Checking multiple assets in sequence requires repeated clicking, opening, closing, and re-opening.
2. **Native `<select>` Dropdowns & Hidden Active Filters:** Filters (Category, Status, Location) rely on native browser selects. They lack live counts, visual distinction, and active indicator chips. Users cannot quickly see what filters are active or clear them with a single click.
3. **Hidden Key Metrics:** The total inventory count and the total valuation of loaded items (`฿{folderValuation}`) are trapped in the bottom sticky footer bar, hidden from the primary eye scan path.
4. **Visual Blandness in Table Rows:** Every item row renders a generic SVG category icon, even when a high-resolution asset photograph (`image_url`) is attached to the record.
5. **No Row Hover Quick-Actions:** To print a QR label or copy an asset number, users must open the full Inspector drawer, adding unnecessary clicks for high-frequency actions.

### 1.3 Core Redesign Goals ("Impeccable Experience")
- **Lightning-Fast Scanning (Non-blocking Split-Pane):** On desktop screens, clicking an item smoothly docks the Inspector on the right (~35% width) while keeping the table active on the left (~65% width) without any dark backdrop, allowing instant row switching and arrow-key navigation.
- **Smart Filter Bar & Top-Level Metrics:** Convert native selects into modern Filter Pills with active chip indicators, clear-all functionality, item counts in segmented tabs (`ทั้งหมด`, `ครุภัณฑ์`, `วัสดุ`), and live folder valuation displayed in the top toolbar.
- **Rich Data Rows with Real Thumbnails:** Display crisp 36×36px photo thumbnails with hover-zoom tooltip previews, one-click asset code copying, and instant row-hover action buttons (Copy, Print QR, Edit).
- **Flawless Keyboard Ergonomics:** Full support for `ArrowUp`/`ArrowDown` row navigation, `Escape` to close inspector, `/` to focus search, and `Space` for multi-item selection.
- **Zero Performance & Bundle Regressions:** Retain 60 FPS virtual scrolling via `useItemWindow`, preserve client-side image fallback on error, and maintain full dark mode support using semantic design tokens.

---

## 2. User Workflows & Ergonomics

### 2.1 Primary User Workflows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Workflow Comparison                             │
├────────────────────────────────────────────────────────────────────────┤
│ CURRENT WORKFLOW:                                                      │
│ Click Row -> Wait Modal Slide -> Dark Backdrop Covers Screen ->        │
│ Read Details -> Click X / Backdrop to Close -> Click Next Row -> ...   │
│                                                                        │
│ REDESIGNED WORKFLOW (Impeccable):                                      │
│ Click Row -> Inspector Docks into Right Pane (No Backdrop) ->          │
│ Press ArrowDown / Click Row 2, Row 3 -> Details Update Instantly ->    │
│ Press Esc to Close Panel                                               │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Sequential Asset Auditing:** A staff member walks through an inventory list comparing physical items with records. With the Docked Split-Pane and arrow keys (`↑` / `↓`), each item's details, photos, and location update in real-time without modal pop-ups.
2. **Instant QR Sticker Printing:** A staff member wants to print a label for an asset. Instead of opening the inspector, they hover the row and click the `🏷️ พิมพ์ป้าย` button right on the row.
3. **Filter Navigation & Quick Reset:** A user filters by "ชำรุด/ส่งซ่อม" and "อาคาร 1". Active chips appear above the table. Once finished, they click "ล้างตัวกรองทั้งหมด" to return to the full catalog in 1 click.

---

## 3. Detailed UI / UX Specification

### 3.1 Dual-Pane Adaptive Layout (Docked Split-Pane)

| Viewport Width | Inspector Behavior | Table Behavior | Backdrop |
|---|---|---|---|
| **Desktop (≥ 1024px)** | **Docked Split-Pane** (w-[380px] to w-[440px], fixed on right) | Shrinks smoothly to `flex-1 min-w-0` (~60–65%) | **None** (Fully clickable table) |
| **Mobile / Tablet (< 1024px)** | **Slide-Over Drawer** (`w-[min(460px,100vw)]`) | Stays 100% width behind drawer | `bg-black/50 backdrop-blur-xs` |

#### Keyboard Shortcuts:
- `ArrowDown` / `ArrowUp`: Advance active inspected item to next/previous loaded item.
- `Escape`: Close Inspector and restore focus to table row.
- `/`: Focus search input.
- `Enter`: Open Inspector for focused row (or navigate on double click).
- `Space`: Toggle checkbox selection for focused row.

---

### 3.2 Smart Filter Bar & Top-Level Metrics Strip

#### Layout Structure:
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [Title: รายการทะเบียนพัสดุ]    [แท็บ: ทั้งหมด (1,240) | ครุภัณฑ์ (850) | วัสดุ (390)]   [List/Grid] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Search: ค้นหา... [/] ] [หมวดหมู่ ▾] [สถานะ ▾] [สถานที่ ▾]     [มูลค่า: ฿1,420,000] [Excel]  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Active Chips: หมวดหมู่: คอมพิวเตอร์ ✕] [สถานะ: ใช้งานปกติ ✕]   [ล้างตัวกรองทั้งหมด]        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Segmented Tabs with Counts:**
   - Pills render real item counts from `sidebarData` / report stats.
   - Selected state: `bg-card text-foreground font-semibold shadow-xs border border-border/50`.
2. **Filter Pills with Popovers:**
   - Styled as compact buttons (`h-9 px-3 text-xs font-semibold rounded-lg border border-input bg-card`).
   - Active state displays accent ring and check indicator.
3. **Active Filter Chips Bar:**
   - Displayed conditionally only when `category_id`, `status`, or `location_id` is set.
   - Individual chip: `[ Label: Value ✕ ]` with `hover:bg-muted` and one-click removal.
   - Global reset: `[ ล้างตัวกรองทั้งหมด ]` resets all filter parameters to default.
4. **Top Valuation & Counter:**
   - Folder Valuation moved from footer to top right: `มูลค่ารวม: ฿{folderValuation.toLocaleString()}` in `text-xs font-bold text-primary`.

---

### 3.3 Rich Table Rows, Thumbnails & Row Hover Actions

#### Columns Configuration (List View):
1. **Checkbox:** Multi-selection master and row checkboxes (`w-10`).
2. **Visual Thumbnail (`w-12`):**
   - If `item.image_url`: Render `<img src={item.image_url} className="w-9 h-9 rounded-lg object-cover" />`
   - Hover zoom: Floating popup displaying larger preview (160×160px) with photo shadow.
   - Fallback: Crisp SVG category/type icon with `bg-muted`.
3. **Compound Primary Column:**
   - Line 1: Item Name (bold, truncate).
   - Line 2: Asset Code / Serial No (Mono badge with one-click copy) + Brand / Model.
4. **Item Type (`w-24`, hidden on mobile):** Asset or Material badge.
5. **Category (`w-32`, hidden on mobile):** Category name.
6. **Quantity (`w-24`):** Numeric quantity + unit.
7. **Location (`w-36`):** Location pin and room name.
8. **Status (`w-32`):** Semantic `StatusBadge` with status dot.
9. **Row Actions (Trailing):**
   - Visible on Row Hover (`group-hover:opacity-100 opacity-0 transition-opacity`):
     - `📋 Copy Asset No`
     - `🏷️ Print QR Label`
     - `✏️ Edit Item` (Staff / Admin only)

---

### 3.4 Inspector Panel Architecture

- **Docked Mode (Desktop):**
  - Rendered inline inside the desktop container layout next to `<ItemsList>`:
    `<aside className="w-[420px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">`
  - Closes with top `✕` button or `Esc`.
  - Header displays item name, status, and navigation indicator (`Item X of Y`).
  - Body includes full-width image (with `ZoomableImage`), spec breakdown, custodian info, and direct actions.
- **Drawer Mode (Mobile):**
  - Retains Radix Dialog / Portal with backdrop for touch ergonomics.

---

## 4. Technical Implementation & Modular Decomposition

```
app/(dashboard)/items/
  ├── items-explorer-client.tsx      <- Main Orchestrator (state, split layout, keyboard events)
  └── page.tsx                      <- Server Component data query
features/items/components/
  ├── items-filter-bar.tsx          <- Extracted: Search, filter popovers, active chips, metrics
  ├── items-list-view.tsx           <- Enhanced: Row hover actions, image thumbnails, mono copy badge
  ├── item-thumbnail.tsx            <- Extracted: 36x36px image thumbnail with hover-zoom popover
  ├── items-grid-view.tsx           <- Enhanced: Grid card with status badge and location
  ├── item-inspector-drawer.tsx     <- Enhanced: Supports both docked mode and overlay drawer mode
  └── items-bulk-bar.tsx            <- Floating batch action bar (preserved)
```

### 4.1 State Management in `ItemsExplorerClient`
- `inspectedItem`: Currently selected `ItemListRow | null`.
- `inspectorMode`: `'docked' | 'drawer'` determined by `window.innerWidth >= 1024`.
- `selectedItemIds`: Set of item UUIDs for bulk operations.
- `searchParams`: Synced bidirectionally with URL for shareable filtered views.

---

## 5. Security & Constraints Compliance

1. **RBAC Rules:**
   - Viewer role: Read-only. Quick Edit action button and Bulk Edit bar are strictly hidden.
   - Staff / Admin: Quick Edit button rendered only when `userCanWrite` is true.
2. **Thai-First UI & Typography:**
   - All labels, tooltips, and badges use official Thai terms (`ครุภัณฑ์`, `วัสดุ`, `ใช้งานปกติ`, `ล้างตัวกรองทั้งหมด`).
   - Capriola font for numeric/code badges (`tabular-nums font-mono`), Sarabun font for Thai content.
3. **Semantic CSS Tokens:**
   - 100% adherence to design tokens: `bg-card`, `bg-muted`, `border-border`, `text-primary`, `text-muted-foreground`. Zero hardcoded slate classes.

---

## 6. Verification & Testing Strategy

### 6.1 Automated Tests
1. **Component Test (`tests/component/items-filter-bar.test.tsx`):**
   - Verify category, location, and status filters update query parameters.
   - Verify active chips render correctly when filters are present.
   - Verify clicking "ล้างตัวกรองทั้งหมด" clears all active filters.
   - Verify pressing `/` focuses the search input.
2. **Inspector Test (`tests/component/items-explorer-inspector.test.tsx`):**
   - Verify selecting an item docks the inspector on desktop without modal backdrop.
   - Verify pressing `ArrowDown` / `ArrowUp` changes the active inspected item.
   - Verify pressing `Escape` closes the docked inspector.
3. **Row Quick-Actions Test (`tests/component/items-list-row.test.tsx`):**
   - Verify hovering displays quick action buttons.
   - Verify clicking Print QR opens the `AssetTagModal`.
   - Verify clicking Copy badge copies asset number to clipboard.
4. **Quality Gates:**
   - `npm run typecheck`: Strict mode verification with zero errors.
   - `npm test`: Full test suite green.

---

## 7. Next Steps
Upon user review and approval of this specification document:
1. Commit this specification to Git.
2. Invoke `writing-plans` skill to generate the detailed, step-by-step implementation tasks.
