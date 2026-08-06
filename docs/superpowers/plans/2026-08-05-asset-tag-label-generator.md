# Direct Mobile Link QR Code & Dual Barcode Asset Tag Generator Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Direct Web Link QR Code generation (`https://<domain>/items/<item_id>`) alongside Code 128 Barcodes on asset sticker tags so mobile phone camera apps scan physical tags and immediately open item details in the browser.

**Architecture:**
1. Pure SVG QR Code generator helper in `lib/qr-code.ts` with unit tests in `lib/qr-code.test.ts`.
2. Update `ItemStickerData` to include item `id` for direct URL resolution (`/items/[id]`).
3. Update `components/ui/asset-tag-modal.tsx` to render Dual Codes (Code 128 Barcode + Direct Link QR Code SVG) across all 3 sticker presets.
4. Pass item `id` from Item Detail page (`app/(dashboard)/items/[id]/page.tsx`) and Items Explorer batch bar (`app/(dashboard)/items/items-explorer-client.tsx`).
5. Verify via component tests and test suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).

---

### Task 1: Create SVG QR Code Generator Utility

**Files:**
- Create: `lib/qr-code.ts`
- Create: `lib/qr-code.test.ts`

- [ ] **Step 1: Write unit tests in `lib/qr-code.test.ts`**
  Test QR matrix generation for web URLs (e.g. `https://camms.app/items/123-abc`).
- [ ] **Step 2: Implement QR Code SVG generator in `lib/qr-code.ts`**
  Pure SVG path generator producing clean scalable QR Code modules.
- [ ] **Step 3: Run unit tests**
  Run: `npm test -- lib/qr-code.test.ts`
- [ ] **Step 4: Commit**

---

### Task 2: Integrate QR Code & Item ID into AssetTagModal

**Files:**
- Modify: `components/ui/asset-tag-modal.tsx`
- Modify: `tests/component/asset-tag-modal.test.tsx`

- [ ] **Step 1: Update `ItemStickerData` interface to include `id?: string`**
- [ ] **Step 2: Add Direct Link QR Code rendering in `SingleStickerItem`**
  Construct URL `https://<domain>/items/<id>` and render SVG QR Code alongside Code 128 Barcode.
- [ ] **Step 3: Update component tests in `tests/component/asset-tag-modal.test.tsx`**
  Verify QR Code SVG element rendering and URL fallback.
- [ ] **Step 4: Run component tests**
  Run: `npm test -- tests/component/asset-tag-modal.test.tsx`
- [ ] **Step 5: Commit**

---

### Task 3: Pass Item ID from Detail Page & Items Explorer

**Files:**
- Modify: `app/(dashboard)/items/[id]/page.tsx`
- Modify: `app/(dashboard)/items/[id]/item-detail-actions.tsx`
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`

- [ ] **Step 1: Pass item `id` in `ItemDetailActions` on detail page**
- [ ] **Step 2: Pass item `id` in `selectedItemsData` on Items Explorer page**
- [ ] **Step 3: Run full verification suite**
  Run: `npm test && npm run typecheck && npm run lint && npm run build`
- [ ] **Step 4: Commit**
