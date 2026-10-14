# Design Specification: Category Combo Chart X-Axis Overlap Resolution

**Status:** Proposed  
**Date:** 2026-10-14  
**Topic:** Resolving X-Axis Label Collision and Right Boundary Overlap in Reports  
**Target:** `features/reports/components/category-combo-chart.tsx`  
**Related Components:** `features/reports/components/reports-list.tsx`, `tests/component/category-combo-chart.test.tsx`

---

## 1. Problem Statement & Goals

### 1.1 Context
In CAMMS (Center Asset & Material Management System), the Materials & Registry Report page (`/reports`) includes a consolidated visualizer component, `CategoryComboChart`, rendering:
- Left Y-Axis: Total inventory quantity and active count (bar chart).
- Right Y-Axis: Usability rate percentage (trend line + dots).
- X-Axis: Inventory categories (Thai text labels).
- Side Panel: Category breakdown list with dual-percentage bars.

### 1.2 Observed Problem
When the dataset contains more than 5 categories (typical units have 8–15 categories), the X-axis labels become severely congested and overlap one another:
1. **Slot Width Deficit:** `plotWidth = 504px` divided by 8–12 categories leaves only $42\text{--}63\text{px}$ per category slot, while 10-character Thai strings (`text-[11px]`) require $65\text{--}85\text{px}$.
2. **Centered Anchoring Spread:** Labels currently use `textAnchor="middle"`, spreading wide on both left and right sides of each slot center, colliding with neighboring labels.
3. **Tail-End / Right Boundary Collision:** The last category's label extends past `plotRight` ($552\text{px}$), overlapping with the Right Y-Axis level 0 tick label (`0%` at $x = 560\text{px}, y = 269\text{px}$).
4. **Thai Truncation Degradation:** Naive `.slice(0, maxLabelLen)` risks cutting Thai combining vowels and tone marks, leading to floating diacritics.

### 1.3 Goals
1. **Eliminate All Label Collisions:** Ensure zero overlapping labels regardless of category count (tested up to 15 categories).
2. **Protect Boundary Labels:** Completely prevent tail-end labels from intersecting with the Right Y-Axis labels or the SVG bounding box.
3. **Preserve Readability & Aesthetics:** Maintain clean Thai typography, clear hover states, and smooth responsive SVG scaling.
4. **Zero Overhead:** Keep the pure native SVG implementation without adding heavy charting libraries (e.g. Recharts or Chart.js) to preserve bundle budget.

---

## 2. Technical Architecture & Design

### 2.1 Geometric Adjustments

To allow adequate vertical room for angled text without shrinking the plot area:

| Parameter | Current Value | Proposed Value | Rationale |
|---|---|---|---|
| `svgHeight` | `320px` | `330px` | Adds 10px total height for angled label clearance |
| `paddingBottom` | `54px` | `64px` | Allocates vertical depth for rotated Thai labels |
| `plotHeight` | `238px` | `238px` | Preserves the exact plot drawing height |
| `plotBottom` | `266px` | `266px` | Preserves grid and bar baseline alignment |

### 2.2 Dynamic Angled Rotation (-35°) with End-Anchoring

Instead of static horizontal text, the chart dynamically adapts based on category density:

```ts
const shouldRotate = count > 5 || slotWidth < 70
const maxLabelLen = shouldRotate ? 14 : (count > 4 ? 8 : 12)
```

#### Coordinate & Transform Calculation:
When `shouldRotate` is active:
- **Baseline Position:** $y = \text{plotBottom} + 14$ ($280\text{px}$)
- **Anchor Point:** `textAnchor="end"`
- **Rotation Transform:** `transform="rotate(-35, ${d.slotCenter}, ${plotBottom + 14})"`

#### Why This Resolves the Tail-End Collision:
With `textAnchor="end"` and a `-35°` rotation:
1. The text anchor is positioned at the top-right of the label (directly beneath the slot center).
2. The body of the text extends **downward and to the left** (towards the bottom-left).
3. The rightmost point of the label never exceeds `slotCenter`.
4. For the final category ($d.index = count - 1$), the text flows away from the right margin, creating a clean buffer of at least $25\text{px}$ before the Right Y-axis `0%` tick.

```
Visual Flow of Rotated Label:
         slotCenter (Anchor)
             •
            / 
           /  [Category Label] (Rotated -35°, flows leftward)
          /
```

### 2.3 Safe Thai Text Truncation

Create an inline helper to prevent splitting Thai combining characters (vowels and tone marks) at boundary lengths:

```ts
function truncateCategoryLabel(name: string, maxLen: number): string {
  if (!name || name.length <= maxLen) return name
  
  // Cut string to target length
  let cut = name.slice(0, maxLen)
  
  // If character immediately following the cut is a Thai combining character, 
  // advance or contract to avoid orphaned tone marks
  const thaiCombiningRegex = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/
  while (cut.length > 0 && thaiCombiningRegex.test(name.charAt(cut.length))) {
    cut = cut.slice(0, -1)
  }
  
  return `${cut.trim()}…`
}
```

Full category names remain accessible via:
1. Native SVG `<title>{d.category}</title>` for hover tooltips.
2. The synchronized `Category Breakdown` sidebar list on the right.

---

## 3. Detailed Component Modification Plan

### 3.1 Targeted File: `features/reports/components/category-combo-chart.tsx`

1. **Update Chart Dimensions:**
   ```tsx
   const svgWidth = 600
   const svgHeight = 330
   const paddingLeft = 48
   const paddingRight = 48
   const paddingTop = 28
   const paddingBottom = 64
   ```

2. **Update X-Axis Mapping Block:**
   ```tsx
   {/* X-Axis Category Labels */}
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

---

## 4. Testing & Quality Verification

### 4.1 Automated Component Tests (`tests/component/category-combo-chart.test.tsx`)
1. **Sparse Category Test (<= 4 categories):**
   - Asserts that `transform` attribute is `undefined` or null (labels remain horizontal).
   - Asserts `textAnchor="middle"`.
2. **Dense Category Test (>= 8 categories):**
   - Renders mock dataset with 8 to 12 categories.
   - Verifies all `<text key^="x-label">` have `transform="rotate(-35, ...)"` and `textAnchor="end"`.
3. **Tail-End Boundary Non-Collision Test:**
   - Verifies the rightmost label coordinate does not exceed `svgWidth - paddingRight`.
4. **Thai Safe Truncation Test:**
   - Tests categories containing complex Thai vowels (e.g. `เครื่องใช้ไฟฟ้าและอิเล็กทรอนิกส์`) to verify ellipsis is appended cleanly without orphan marks.

### 4.2 Quality Gate Commands
```bash
# 1. Run isolated component tests
node --import tsx --max-old-space-size=2048 --test tests/component/category-combo-chart.test.tsx

# 2. Typecheck & lint
npm run typecheck
npm run lint
```

---

## 5. Review & Approval Gate

- [x] Scope bounded to SVG visual layout and Thai label positioning.
- [x] Zero API breaking changes to parent component `ReportsList`.
- [x] Zero database, schema, or RPC modifications.
- [x] Compliance with CAMMS Thai-first and Accessibility principles.
