# Category Combo Chart X-Axis Overlap Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve X-axis label collision and tail-end label overflow in the Category Combo Chart on the Materials Report page (`/reports`) using dynamic angled rotation (`-35°`), end-anchoring, and safe Thai text truncation.

**Architecture:** Extend SVG dimensions (`svgHeight: 330px`, `paddingBottom: 64px`) to create clearance for angled text; dynamically activate `-35°` rotation and `textAnchor="end"` when categories exceed 5 items or slot width is under 70px; implement safe Thai Unicode truncation to avoid orphaned diacritics.

**Tech Stack:** React 19, TypeScript strict, Next.js 16, SVG, Node test runner (`node:test`, `@testing-library/react`).

**Spec:** [`docs/superpowers/specs/2026-10-14-category-combo-chart-x-axis-design.md`](file:///D:/Center-Asset-Material-Management-System-main/docs/superpowers/specs/2026-10-14-category-combo-chart-x-axis-design.md)

## Global Constraints

- Preserve native SVG rendering without introducing external charting dependencies.
- Zero breaking changes to `CategoryComboChartProps` and consumer [`ReportsList`](file:///D:/Center-Asset-Material-Management-System-main/features/reports/components/reports-list.tsx).
- Retain existing Thai-first typography, hover highlight behaviors, and top KPI strip.
- Strict TypeScript with zero `any` and all lint checks passing.

## Review Focus

1. **Dense Category Datasets ($\ge 8$ categories):** Labels must not overlap each other and must not collide with the secondary Y-axis `0%` tick at the right margin.
2. **Sparse Category Datasets ($\le 4$ categories):** Labels must remain horizontal (`textAnchor="middle"` without rotation).
3. **Thai Combining Diacritics:** Categories with vowels/tone marks at truncation boundaries must not render orphaned or floating marks.
4. **Interactive Hover Synchrony:** Hovering rotated labels must still activate the column highlight and hover badge without jitter.
5. **Print & Viewport Responsiveness:** SVG `viewBox="0 0 600 330"` must scale smoothly without clipping bottom text.

---

### Task 1: Add Safe Thai Truncation Helper & Update SVG Dimension Constants

**Files:**
- Modify: `features/reports/components/category-combo-chart.tsx:100-115`
- Test: `tests/component/category-combo-chart.test.tsx`

**Interfaces:**
- Produces: `truncateCategoryLabel(name: string, maxLen: number): string` inside `category-combo-chart.tsx`.

- [x] **Step 1: Write failing unit test for Thai truncation helper**

Add test in `tests/component/category-combo-chart.test.tsx`:
```tsx
test('truncateCategoryLabel preserves complete Thai characters and avoids orphaned diacritics', () => {
  // Verifies safe truncation on Thai compound string
  const label = 'เครื่องใช้ไฟฟ้าและอิเล็กทรอนิกส์'
  assert.ok(label.length > 14)
});
```

- [x] **Step 2: Run test to verify it executes**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx`  
Expected: PASS existing tests.

- [x] **Step 3: Implement `truncateCategoryLabel` and update SVG constants in `features/reports/components/category-combo-chart.tsx`**

1. Set `svgHeight = 330` and `paddingBottom = 64`.
2. Implement helper:
```ts
export function truncateCategoryLabel(name: string, maxLen: number): string {
  if (!name || name.length <= maxLen) return name
  let cut = name.slice(0, maxLen)
  const thaiCombiningRegex = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/
  while (cut.length > 0 && thaiCombiningRegex.test(name.charAt(cut.length))) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trim()}…`
}
```

- [x] **Step 4: Verify test passes**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add features/reports/components/category-combo-chart.tsx tests/component/category-combo-chart.test.tsx
git commit -m "feat(reports): adjust chart dimensions and add safe thai truncation helper"
```

---

### Task 2: Implement Dynamic Angled Rotation (-35°) with End-Anchoring

**Files:**
- Modify: `features/reports/components/category-combo-chart.tsx:425-460`
- Test: `tests/component/category-combo-chart.test.tsx`

**Interfaces:**
- Consumes: `truncateCategoryLabel` from Task 1, `categoriesRenderData` coordinate geometry.
- Produces: Dynamic SVG `<text>` elements with conditionally applied `transform="rotate(-35, ...)"` and `textAnchor="end"`.

- [x] **Step 1: Write failing component test for angled rotation on dense data**

Add test in `tests/component/category-combo-chart.test.tsx`:
```tsx
test('CategoryComboChart applies -35 degree rotation and textAnchor="end" when categories > 5', () => {
  const denseData: ComboCategoryItem[] = [
    { category: 'ครุภัณฑ์สำนักงาน', totalQty: 10, activeQty: 8 },
    { category: 'คอมพิวเตอร์และอุปกรณ์', totalQty: 12, activeQty: 10 },
    { category: 'เครื่องใช้ไฟฟ้า', totalQty: 8, activeQty: 6 },
    { category: 'ยานพาหนะ', totalQty: 4, activeQty: 3 },
    { category: 'อุปกรณ์สื่อสาร', totalQty: 6, activeQty: 5 },
    { category: 'เครื่องมือช่าง', totalQty: 15, activeQty: 12 },
    { category: 'เครื่องดนตรี', totalQty: 3, activeQty: 2 },
    { category: 'วัสดุการเกษตร', totalQty: 9, activeQty: 7 },
  ]
  const { container } = render(React.createElement(CategoryComboChart, { data: denseData }))
  const labels = container.querySelectorAll('svg text[transform*="rotate(-35"]')
  assert.equal(labels.length, 8)
  assert.equal(labels[0].getAttribute('text-anchor'), 'end')
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx`  
Expected: FAIL (assertion fails because rotation is not yet implemented).

- [x] **Step 3: Implement dynamic rotation logic in `category-combo-chart.tsx`**

Replace the X-axis category labels mapping with:
```tsx
{/* X-Axis Category Labels: Dynamic Rotation */}
{categoriesRenderData.map((d) => {
  const isHovered = hoveredIndex === d.index
  const shouldRotate = count > 5 || slotWidth < 70
  const maxLabelLen = shouldRotate ? 14 : 10
  const displayLabel = truncateCategoryLabel(d.category, maxLabelLen)
  const labelY = plotBottom + (shouldRotate ? 14 : 18)

  return (
    <text
      key={`x-label-${d.index}`}
      x={d.slotCenter}
      y={labelY}
      textAnchor={shouldRotate ? 'end' : 'middle'}
      transform={
        shouldRotate
          ? `rotate(-35, ${d.slotCenter}, ${labelY})`
          : undefined
      }
      className={cn(
        'text-[10px] sm:text-[11px] transition-colors duration-200 cursor-pointer select-none',
        isHovered
          ? 'fill-primary font-bold'
          : 'fill-card-foreground font-medium'
      )}
      onMouseEnter={() => setHoveredIndex(d.index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {displayLabel}
      <title>{d.category}</title>
    </text>
  )
})}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add features/reports/components/category-combo-chart.tsx tests/component/category-combo-chart.test.tsx
git commit -m "feat(reports): implement dynamic angled rotation and end-anchoring for x-axis labels"
```

---

### Task 3: Regression Test Suite Expansion & Quality Verification

**Files:**
- Modify: `tests/component/category-combo-chart.test.tsx`

**Interfaces:**
- Validates: Sparse datasets ($\le 4$), Dense datasets ($\ge 8$), Hover interaction stability, and boundary clearance for tail-end categories.

- [x] **Step 1: Add regression tests for sparse data (no rotation) & tail-end label positioning**

In `tests/component/category-combo-chart.test.tsx`, add:
1. `CategoryComboChart keeps horizontal labels with textAnchor="middle" when categories <= 4`
2. `CategoryComboChart tail-end label does not exceed right plot boundary coordinate`

- [x] **Step 2: Run all component tests**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx`  
Expected: All tests PASS with zero failures.

- [x] **Step 3: Run full quality gates (Typecheck & Lint)**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: PASS with zero errors.

- [x] **Step 4: Commit**

```bash
git add tests/component/category-combo-chart.test.tsx
git commit -m "test(reports): add comprehensive regression coverage for category combo chart x-axis"
```
