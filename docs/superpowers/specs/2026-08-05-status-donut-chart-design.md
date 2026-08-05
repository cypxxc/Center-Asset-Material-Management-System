# Interactive Status Donut Chart Component Design

## Overview
Fix hit-testing overlap and hover mismatch bugs in the Dashboard Status Donut Chart by building a dedicated client component (`StatusDonutChart`) with interactive tooltips and synchronized legend highlighting.

## Problem Statement
The current Dashboard SVG Donut Chart overlays 4 full-circumference `<circle>` elements using `strokeDashoffset`. Zero-quantity or overlapping circle gaps trap mouse hover events, causing hovering over one color (e.g. green or white gap) to trigger hover effects on another color (e.g. red). Furthermore, no interactive tooltip exists to display exact counts and percentages.

## Design Details

### 1. New Component: `components/dashboard/status-donut-chart.tsx`
- Client Component (`'use client'`).
- Props:
  - `totalQuantity`: number
  - `statusData`: Array of `{ key: string; label: string; qty: number; pct: number; color: string; hoverColor: string }`
- Rendering:
  - Omit zero-quantity segments (`qty === 0`) from rendering to eliminate invisible stroke hit-testing traps.
  - Calculate `strokeDasharray` and `strokeDashoffset` precisely for non-zero segments.
  - Interactive Tooltip: Display floating tooltip box showing `${label}: ${qty.toLocaleString()} ชิ้น (${pct.toFixed(0)}%)` when hovered.
  - Synchronized Legend: Hovering a legend item highlights the chart segment and vice versa.

### 2. Integration: `app/(dashboard)/dashboard/page.tsx`
- Import `StatusDonutChart` into the dashboard page layout.
- Pass server-calculated status metrics to `StatusDonutChart`.

## Testing Plan
- Create component test `tests/component/status-donut-chart.test.tsx`.
- Test rendering with non-zero status data and empty status data.
- Test hover event state updates.
- Run full test suite (`npm test`) and typecheck (`npm run typecheck`).
