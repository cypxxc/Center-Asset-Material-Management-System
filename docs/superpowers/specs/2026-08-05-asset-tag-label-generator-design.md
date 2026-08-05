# Printable Asset Tag & Barcode Label Generator Design

## Overview
Implement an official asset sticker label generator modal and `@media print` layout in CAMMS to print physical barcodes / QR code tags for inventory items.

## Problem Statement
Field staff need to physically tag assets with scannable labels (QR codes / Barcodes) containing asset numbers, item names, serial numbers, and locations. Currently, CAMMS provides digital tracking but lacks a print-ready asset sticker generator.

## Design Details

### 1. Pure SVG Code 128 & QR Code Renderers (`lib/barcode.ts`)
- Lightweight, zero-dependency SVG Barcode (Code 128) and QR Code SVG generator helper.
- Generates clean, high-contrast SVG paths for crisp printing on thermal sticker printers or regular A4/sticker sheets.

### 2. Asset Tag Modal & Print Component (`components/ui/asset-tag-modal.tsx`)
- Props: `isOpen: boolean`, `onClose: () => void`, `item: ItemDetail`
- Features:
  - Preset Selector: Standard (70mm × 35mm), Small (50mm × 25mm), Compact Barcode (40mm × 20mm).
  - Print Preview: Live modal preview of the physical sticker.
  - One-Click Print: Triggers `window.print()` with `@media print` rules hiding site layout (sidebar, header, buttons) and displaying only the formatted asset sticker centered on the page.

### 3. Detail Page Integration (`app/(dashboard)/items/[id]/page.tsx`)
- Add "พิมพ์ลาเบลติดครุภัณฑ์" button in the action bar of the item detail page.

## Testing Plan
- Create unit test `lib/barcode.test.ts` verifying SVG Code 128 barcode generation.
- Create component test `tests/component/asset-tag-modal.test.tsx` verifying modal open/close and sticker content rendering.
- Run full test suite (`npm test`) and typecheck (`npm run typecheck`).
