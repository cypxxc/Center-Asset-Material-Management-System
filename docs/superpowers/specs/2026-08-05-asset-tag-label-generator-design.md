# Direct Mobile Link QR Code & Dual Barcode Asset Tag Generator Design

## Overview
Enhance the Printable Asset Tag Generator (ระบบพิมพ์สติ๊กเกอร์ติดครุภัณฑ์) in CAMMS to generate physical sticker labels containing both **Code 128 Barcodes** (for handheld laser scanners) and **Direct Web URL QR Codes** (`https://<domain>/items/<item_id>`). When field staff point any smartphone camera (iOS, Android, LINE scanner) at the physical asset sticker, the phone immediately displays a link notification to open the item detail page directly in the mobile browser.

## Problem Statement
Previously, QR / Barcode labels encoded only raw alphanumeric string identifiers (e.g. `AST-2026-008`). When scanned by a smartphone's native camera app, the phone displayed raw text instead of navigating to the item detail page. Field staff had to manually open the CAMMS web app, navigate to search, or open the in-app scanner.

## Design Specs

### 1. Pure SVG QR Code Generator Helper (`lib/qr-code.ts`)
- Lightweight, zero-dependency QR Code matrix & SVG path generator function.
- Converts input URL string into an optimal QR Code SVG path representation with high contrast for paper/thermal print readability.

### 2. Dual Code Sticker Tag Layout (`components/ui/asset-tag-modal.tsx`)
- **Sticker Header**: `CAMMS — ระบบบริหารจัดการทรัพย์สิน`
- **Sticker Body**:
  - Item Name (`item_name`)
  - Asset Number (`asset_no`) & Serial Number (`serial_no`)
  - Location Name (`location_name`)
- **Scannable Codes (Dual Representation)**:
  - **Code 128 Barcode**: Encodes `asset_no` / `serial_no` for traditional USB/Bluetooth laser desktop scanners.
  - **Direct Web Link QR Code**: Encodes `https://<domain>/items/<id>` (or relative origin fallback) so smartphone camera apps trigger standard web link navigation ("Open in Browser").
- **Sticker Presets**:
  1. **Standard (70mm × 35mm)**: Side-by-side or stacked layout showing both Code 128 Barcode and Direct Link QR Code.
  2. **Small (50mm × 25mm)**: Compact layout with high-density QR Code + Barcode.
  3. **Compact (40mm × 20mm)**: Focused tag format with Direct Link QR Code & Asset Number.

### 3. Application Integration Points
- **Item Detail Page (`app/(dashboard)/items/[id]/page.tsx`)**: Single item printable tag with exact item ID URL.
- **Items Explorer (`app/(dashboard)/items/items-explorer-client.tsx`)**: Batch selection print button generating printable sticker tag sheets/rolls with individual item web URLs.

## Testing & Verification Plan
- Unit tests in `lib/qr-code.test.ts`: Verify QR matrix and SVG path generation for item URLs.
- Component tests in `tests/component/asset-tag-modal.test.tsx`: Test QR Code SVG rendering, URL construction, size presets, and print layout.
- Verification commands: `npm test && npm run typecheck && npm run lint && npm run build`.
