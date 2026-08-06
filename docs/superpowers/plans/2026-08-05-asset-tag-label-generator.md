# Printable Asset Tag & Barcode Label Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a printable asset tag sticker generator with Code 128 / QR Code SVG rendering, 3 standard sticker size presets (Standard 70x35mm, Small 50x25mm, Compact 40x20mm), `@media print` layout, and integration into both Item Detail page and Items Explorer batch selection.

**Architecture:** 
1. SVG Barcode generator in `lib/barcode.ts` with unit tests in `lib/barcode.test.ts`.
2. Printable Modal component in `components/ui/asset-tag-modal.tsx` supporting single and batch sticker printing, 3 presets, CAMMS official header, and `@media print` isolation.
3. Single item print action in `app/(dashboard)/items/[id]/page.tsx` & `item-detail-actions.tsx`.
4. Multi-item batch print action in `app/(dashboard)/items/items-explorer-client.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, SVG, CSS `@media print`, TypeScript.

---

### Task 1: SVG Barcode & QR Code Utility Helper

**Files:**
- `lib/barcode.ts`
- `lib/barcode.test.ts`

- [ ] **Step 1: Verify and complete Code 128 & SVG helper in `lib/barcode.ts`**
- [ ] **Step 2: Run unit test `lib/barcode.test.ts`**
  Run: `npm test -- lib/barcode.test.ts`
- [ ] **Step 3: Commit**

---

### Task 2: Enhance Asset Tag Modal Component

**Files:**
- `components/ui/asset-tag-modal.tsx`
- `tests/component/asset-tag-modal.test.tsx`

- [ ] **Step 1: Update `components/ui/asset-tag-modal.tsx`**
  - Add official CAMMS header ("CAMMS — ระบบบริหารจัดการทรัพย์สิน").
  - Support single item or array of items (`items: ItemStickerData[]`).
  - Render 3 size presets: Standard (70x35mm), Small (50x25mm), Compact (40x20mm).
  - Include fields: `item_name`, `asset_no`, `serial_no`, `location_name`.
  - Provide crisp `@media print` rules for thermal sticker printers and standard paper.
- [ ] **Step 2: Add component tests in `tests/component/asset-tag-modal.test.tsx`**
- [ ] **Step 3: Run component tests**
  Run: `npm test -- tests/component/asset-tag-modal.test.tsx`
- [ ] **Step 4: Commit**

---

### Task 3: Item Detail Page Integration

**Files:**
- `app/(dashboard)/items/[id]/item-detail-actions.tsx`
- `app/(dashboard)/items/[id]/page.tsx`

- [ ] **Step 1: Add "พิมพ์ลาเบลติดครุภัณฑ์" button to Item Detail action toolbar**
- [ ] **Step 2: Connect `AssetTagModal` in detail page**
- [ ] **Step 3: Verify detail page rendering and modal trigger**
- [ ] **Step 4: Commit**

---

### Task 4: Items Explorer Multi-Item Selection & Batch Print Integration

**Files:**
- `app/(dashboard)/items/items-explorer-client.tsx`

- [ ] **Step 1: Add batch "พิมพ์ลาเบลติดครุภัณฑ์" action button to items selection bar**
- [ ] **Step 2: Connect selected items array to `AssetTagModal`**
- [ ] **Step 3: Verify batch modal trigger and grid print layout**
- [ ] **Step 4: Commit**

---

### Task 5: Full Verification & Code Quality Audit

- [ ] **Step 1: Run unit and component test suite**
  Run: `npm test`
- [ ] **Step 2: Run strict TypeScript check**
  Run: `npm run typecheck`
- [ ] **Step 3: Run ESLint**
  Run: `npm run lint`
- [ ] **Step 4: Run production build**
  Run: `npm run build`
