# Asset Tag Label Generator & A4 Sheet Print System Design

## 1. Overview
The Asset Tag Generator allows office staff and administrators to generate and print physical asset tags/stickers for office equipment, consumables, and assets. This design enhances the existing `AssetTagModal` to support:
1. **A4 Multi-Label Grid Sheets** (e.g., A4 3×8 = 24 labels, A4 2×7 = 14 labels) for standard office inkjet/laser printers.
2. **Thermal Label Presets** (70×35mm, 50×25mm, 40×20mm) for barcode/thermal label printers.
3. **Field Visibility Toggles** to customize printed information (Organization Name, Responsible Person, Location, Price, QR Code, Barcode).
4. **Copy Multiplier** to generate multiple copies of a label per item (ideal for batch quantities).

---

## 2. User Experience & Interface Design

### 2.1 Modal Controls Header & Configuration Bar
- **Preset Selector (Tabs/Dropdown)**:
  - `A4 3×8 (24 ป้าย/แผ่น - 70×37mm)`
  - `A4 2×7 (14 ป้าย/แผ่น - 105×42mm)`
  - `Standard Thermal (70×35mm)`
  - `Small Thermal (50×25mm)`
  - `Compact Thermal (40×20mm)`
- **Copies Multiplier**:
  - Input field to set number of sticker copies per item (default: 1, min: 1, max: 50).
- **Field Display Options (Collapsible / Toggle Buttons)**:
  - `ชื่อหน่วยงาน / CAMMS` (Default: ON)
  - `รหัสทรัพย์สิน / Serial` (Default: ON)
  - `ผู้รับผิดชอบ` (Default: OFF)
  - `สถานที่จัดเก็บ` (Default: ON)
  - `ราคาทรัพย์สิน` (Default: OFF)
  - `QR Code (สแกนเปิดการ์ดทรัพย์สิน)` (Default: ON)
  - `Code128 Barcode` (Default: ON for standard/A4, auto-compact for smaller sizes)

### 2.2 Print Preview & Sheet Rendering
- **Interactive Live Preview**: Shows the real layout of stickers with pagination or sheet preview.
- **Print Optimization**:
  - CSS `@media print` with explicit `@page` margin rules (`margin: 0` for thermal, standard 5mm margin for A4).
  - CSS Grid with `break-inside: avoid` to prevent sticker cards from being split across page breaks.
  - High-contrast black & white styling optimized for sharp printing without gray artifacts.

---

## 3. Technical Architecture & Component Changes

### 3.1 Extended Data Contract (`ItemStickerData`)
```typescript
export interface ItemStickerData {
  id?: string | null
  item_name: string
  asset_no?: string | null
  serial_no?: string | null
  brand?: string | null
  model?: string | null
  location_name?: string | null
  category_name?: string | null
  responsible_person?: string | null
  unit_price?: number | null
}
```

### 3.2 Label Layout Configurations (`PRESETS`)
```typescript
export type StickerSizePreset = "a4_3x8" | "a4_2x7" | "standard" | "small" | "compact"

export interface PresetConfig {
  id: StickerSizePreset
  label: string
  isSheet: boolean
  sheetGrid?: { cols: number; rows: number; labelWidth: string; labelHeight: string }
  width: string
  height: string
  padding: string
  titleSize: string
  nameSize: string
  metaSize: string
  barcodeHeight: string
  codeSize: string
  qrSize: string
}
```

### 3.3 Print Style Engine
- Dynamically injects or applies dedicated print classes:
  - `.print-sheet-a4-3x8`: CSS Grid `repeat(3, 1fr)` with 37mm row height.
  - `.print-sheet-a4-2x7`: CSS Grid `repeat(2, 1fr)` with 42mm row height.
  - `.print-thermal-roll`: Single-item flex/block sequence.

---

## 4. Security & Permissions
- Read-only feature: Any role (`admin`, `staff`, `viewer`) can view and print asset tags for items they can view.
- No database mutations occur during sticker generation or printing.

---

## 5. Verification & Testing Strategy
1. **Unit & Component Testing (`tests/component/asset-tag-modal.test.tsx`)**:
   - Verify switching between A4 sheet presets and thermal presets.
   - Verify copy multiplier expands items correctly.
   - Verify field toggles (hide/show price, responsible person, organization).
   - Verify print trigger calls `window.print()`.
2. **Automated Verification Pipeline**:
   - `npm test` — all tests pass cleanly.
   - `npm run typecheck` — 0 TypeScript errors with `"strict": true`.
   - `npm run lint` — ESLint flat config passes.
   - `npm run build` — Production build succeeds.
