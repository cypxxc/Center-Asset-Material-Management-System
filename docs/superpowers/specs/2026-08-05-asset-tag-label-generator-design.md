# Public Read-Only Asset Scanning & QR Code Generator Design

## Overview
Enable public, unauthenticated read-only access to asset details when scanning physical QR code sticker tags. When any user (staff or general public) scans a physical asset tag using a smartphone camera, CAMMS displays a clean, official **Public Read-Only Asset Card** without requiring login. If a staff member needs to manage or edit the asset, they can click "เข้าสู่ระบบเพื่อจัดการ" to log in.

## Design Specs

### 1. Unauthenticated Public Access & Route Guarding (`app/(dashboard)/layout.tsx`)
- Update `DashboardLayout` so unauthenticated users (`profile === null`) accessing `/items/[id]` are **not** forcibly redirected to `/login`.
- If `!profile` and the route is `/items/[id]`, render a standalone, mobile-optimized public layout (Clean Header with CAMMS Branding, No Sidebar).
- All other dashboard routes (`/dashboard`, `/items`, `/settings`, `/reports`, `/items/new`, `/items/[id]/edit`) remain strictly guarded by login.

### 2. Public Read-Only Item Detail View (`app/(dashboard)/items/[id]/page.tsx`)
- **Unauthenticated / Guest View (`!profile`)**:
  - Displays **Public Asset Card** with official branding: `CAMMS — ระบบบริหารจัดการทรัพย์สิน`
  - **Asset Information**: Item Name (`item_name`), Asset Number (`asset_no`), Serial Number (`serial_no`), Category, Location, Type, Status Badge (e.g. ใช้งานอยู่, ชำรุด, สำรอง), Brand, Model, Unit Price, Responsible Person, Note/Description, and Item Image.
  - **Action Controls**: All edit buttons, delete buttons, and internal audit timeline logs are hidden.
  - **Staff Access Link**: Displays a prominent button at the bottom: `"เข้าสู่ระบบเพื่อจัดการ (สำหรับเจ้าหน้าที่)"` navigating to `/login?next=/items/<id>`.
- **Authenticated Staff/Admin View (`profile !== null`)**:
  - Displays standard full dashboard shell with sidebar, header, edit button, delete button (if permitted), and audit timeline history.

### 3. Direct Link QR Code Generator (`lib/qr-code.ts` & `components/ui/asset-tag-modal.tsx`)
- QR Code encodes the full public URL `https://<domain>/items/<item_id>`.
- Scanning with any native mobile camera app (iOS / Android / LINE) opens the public read-only asset card instantly.

## Testing & Verification Plan
- Unit test permission and public item access handling.
- Component test `AssetTagModal` direct link QR code rendering and item detail page public rendering.
- Verification commands: `npm test && npm run typecheck && npm run lint && npm run build`.
