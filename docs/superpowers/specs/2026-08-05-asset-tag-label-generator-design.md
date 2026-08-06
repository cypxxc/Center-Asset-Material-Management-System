# Printable Asset Tag & Barcode Label Generator Design

## Overview
Printable Asset Tag & Barcode Label Generator (ระบบพิมพ์สติ๊กเกอร์ติดครุภัณฑ์) for CAMMS to generate physical scannable sticker tags (Code 128 / QR Code) for individual items or batch selections.

## Design Specs

### 1. Asset Tag Label Component & Layout (`components/ui/asset-tag-modal.tsx`)

#### Official Asset Label Design (รูปแบบสติ๊กเกอร์มาตรฐานทางการ)
- **Header**: Organization logo & system name (`CAMMS — ระบบบริหารจัดการทรัพย์สิน`)
- **Body**:
  - Item Name (`item_name`)
  - Asset Number (`asset_no`)
  - Serial Number (`serial_no`)
  - Location Name (`location_name`)
- **Scannable Elements**:
  - High-contrast Code 128 Barcode (SVG paths) for barcode scanners
  - Quick QR Code representation / fallback for mobile camera scanning

#### Sticker Presets (ขนาดสติ๊กเกอร์ 3 ขนาดมาตรฐาน)
1. **Standard (70mm × 35mm)** — สำหรับครุภัณฑ์ทั่วไป (คอมพิวเตอร์, หน้าจอ, เฟอร์นิเจอร์)
2. **Small (50mm × 25mm)** — สำหรับอุปกรณ์ไอทีขนาดเล็ก (แท็บเล็ต, เครื่องมือช่าง)
3. **Compact (40mm × 20mm)** — สำหรับติด Barcode & Asset Tag เฉพาะจุด

#### Batch / Multi-Item Sticker Print
- Supports passing a single item or an array of items `items: ItemStickerData[]`.
- Multi-item selection renders a print grid page layout formatted for continuous sticker rolls or A4 sticker sheets.

### 2. Print System (`@media print`)

- **One-Click Printing**:
  - Triggers native browser print standard (`window.print()`).
  - Hides all web UI components (Sidebar, Top Header, Action Buttons, Backdrop).
  - Isolates and centers `#printable-asset-tag` / batch grid for sticker printers and standard office printers.

### 3. Application Integration Points

- **Item Detail Page (`app/(dashboard)/items/[id]/page.tsx`)**:
  - "พิมพ์ลาเบลติดครุภัณฑ์" button located in the item action toolbar.
- **Items Explorer (`app/(dashboard)/items/items-explorer-client.tsx`)**:
  - Batch action button in the item selection bar allowing staff/admins to select multiple items and print asset tags in bulk.

## Testing & Verification Plan

- `lib/barcode.test.ts`: Verify Code 128 SVG bar pattern generation algorithms and fallback handling.
- `tests/component/asset-tag-modal.test.tsx`: Test modal lifecycle, preset selection, single & multi-item sticker data rendering, accessibility labels.
- Integration & lint checks: `npm test && npm run typecheck && npm run lint`.
