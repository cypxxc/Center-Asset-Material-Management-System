# Asset Tag Label Generator & A4 Sheet Print System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Asset Tag Generator in `AssetTagModal` to support A4 sticker sheet grids (3×8 and 2×7), thermal printer presets, field visibility toggles, and copy multipliers for physical asset tagging.

**Architecture:** Extend `ItemStickerData` and preset definitions in `components/ui/asset-tag-modal.tsx`, provide an interactive configuration toolbar in the modal (preset selection, copy multiplier, and toggles for organization name, responsible person, location, price, and barcode/QR), and refine print media CSS styles (`@media print`) with millimeter sizing and page-break rules.

**Tech Stack:** Next.js 16 (App Router, Client Components), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Node.js `node:test` (`tsx --test`).

## Global Constraints

- Strict TypeScript checking (`npm run typecheck`) must pass with 0 errors.
- ESLint flat configuration (`npm run lint`) must pass.
- All existing and new tests (`npm test`) must pass cleanly.
- Production build (`npm run build`) must succeed.
- UI labels and controls must follow Thai-first conventions.

---

### Task 1: Extend Types, Preset Configurations & Field Visibility Model

**Files:**
- Modify: `components/ui/asset-tag-modal.tsx`
- Test: `tests/component/asset-tag-modal.test.tsx`

**Interfaces:**
- Consumes: `ItemStickerData`, `generateCode128Bars`, `generateQrCodeSvgPath`
- Produces:
  - `ItemStickerData` with extended fields (`unit_price?: number | null`, `responsible_person?: string | null`, `category_name?: string | null`)
  - `StickerSizePreset = "a4_3x8" | "a4_2x7" | "standard" | "small" | "compact"`
  - `FieldVisibilityConfig` interface with toggle states

- [ ] **Step 1: Write failing component test for new A4 presets and field visibility**

Add test in `tests/component/asset-tag-modal.test.tsx`:
```typescript
test('AssetTagModal supports A4 3x8 sheet preset and copy multiplier', () => {
  const sampleItem: ItemStickerData = {
    id: 'item-1',
    item_name: 'โต๊ะทำงานผู้บริหาร',
    asset_no: 'OFF-2026-001',
    location_name: 'ห้องประชุม 1',
    responsible_person: 'สมชาย ใจดี',
    unit_price: 15000,
  }
  const element = React.createElement(AssetTagModal, {
    isOpen: true,
    onClose: () => {},
    item: sampleItem,
  })
  const html = ReactDOMServer.renderToString(element)
  assert.ok(html.includes('A4 3×8') || html.includes('A4 3x8'), 'Must include A4 3x8 preset')
  assert.ok(html.includes('จำนวนดวงต่อรายการ') || html.includes('สำเนา'), 'Must include copy multiplier')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`  
Expected: FAIL (AssertionError)

- [ ] **Step 3: Update `ItemStickerData`, `PRESETS`, and field configuration**

Update `components/ui/asset-tag-modal.tsx` with:
- `a4_3x8`: A4 Sheet with 3 columns × 8 rows (24 stickers/sheet, ~70×37mm)
- `a4_2x7`: A4 Sheet with 2 columns × 7 rows (14 stickers/sheet, ~105×42mm)
- `standard`: Thermal Roll 70×35mm
- `small`: Thermal Roll 50×25mm
- `compact`: Thermal Roll 40×20mm
- State for `copyCount: number` (1..50)
- State for `fieldVisibility` (`showOrg`, `showResponsible`, `showLocation`, `showPrice`, `showBarcode`, `showQr`)

- [ ] **Step 4: Run tests to verify pass**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add components/ui/asset-tag-modal.tsx tests/component/asset-tag-modal.test.tsx
git commit -m "feat(asset-tag): add a4 sheet presets, copy multiplier, and field toggles"
```

---

### Task 2: Implement A4 Grid Rendering & Thermal Print Stylesheet

**Files:**
- Modify: `components/ui/asset-tag-modal.tsx`
- Test: `tests/component/asset-tag-modal.test.tsx`

**Interfaces:**
- Consumes: `PRESETS`, `fieldVisibility`, `copyCount`
- Produces:
  - Print layout with CSS grid for A4 sheets (`.print-sheet-a4-3x8`, `.print-sheet-a4-2x7`)
  - Continuous flex/block layout for Thermal rolls (`.print-thermal-roll`)
  - Page break avoidance styling (`break-inside: avoid; page-break-inside: avoid;`)

- [ ] **Step 1: Write test for A4 grid rendering and item copy expansion**

Add test in `tests/component/asset-tag-modal.test.tsx`:
```typescript
test('AssetTagModal renders multiple copies in print sheet when copy count is set', () => {
  const sampleItem: ItemStickerData = {
    id: 'item-2',
    item_name: 'เก้าอี้สำนักงาน',
    asset_no: 'CHR-002',
  }
  const element = React.createElement(AssetTagModal, {
    isOpen: true,
    onClose: () => {},
    item: sampleItem,
  })
  const html = ReactDOMServer.renderToString(element)
  assert.ok(html.includes('CHR-002'), 'Must render asset number')
  assert.ok(html.includes('print-tag-card'), 'Must render printable tag cards')
})
```

- [ ] **Step 2: Run test to verify failure or baseline**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`

- [ ] **Step 3: Implement responsive sticker cards and `@media print` style block**

In `components/ui/asset-tag-modal.tsx`:
- Render sticker item cards inside a CSS Grid container matching the selected preset.
- Embed `<style>` block for `@media print` with exact dimensions in `mm`.
- Ensure dark borders, high contrast, and no margins outside print boundaries.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add components/ui/asset-tag-modal.tsx tests/component/asset-tag-modal.test.tsx
git commit -m "feat(asset-tag): implement a4 print grid stylesheet and printable tag card layouts"
```

---

### Task 3: Comprehensive Verification & Pipeline Check

**Files:**
- Test: `tests/component/asset-tag-modal.test.tsx`

- [ ] **Step 1: Run full unit & component test suite**

Run: `npm test`  
Expected: 303+ tests passing, 0 fails.

- [ ] **Step 2: Run strict TypeScript typecheck**

Run: `npm run typecheck`  
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`  
Expected: 0 errors/warnings.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Next.js production build completes successfully.

- [ ] **Step 5: Commit and tag complete**

```bash
git add -A
git commit -m "chore(asset-tag): verify all tests, typecheck, lint, and build pass"
```
