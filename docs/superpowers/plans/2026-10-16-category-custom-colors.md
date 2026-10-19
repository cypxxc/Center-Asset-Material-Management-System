# Category Custom Color Wheel & Registry Visual Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enable custom RGB/HEX color selection for asset categories in Settings with interactive swatches/color wheel, and render accessible, theme-safe category badges across the items registry table (`/items`), grid view, and inspector drawer.

**Architecture:** Add `color VARCHAR(7) NOT NULL DEFAULT '#64748B'` to `categories` table and Drizzle schema; enforce strict 6-digit `#RRGGBB` format via Zod preprocessing; propagate `color` through Supabase and Standalone Postgres query projections; render category badges using SSR-safe `color-mix` and alpha backgrounds without runtime JS theme detection; widen registry category column to `w-44` and revalidate `/items` cache on category mutations.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Server Components), React 19, TypeScript (strict), Drizzle ORM, Supabase PostgreSQL / Standalone Docker PostgreSQL, Tailwind CSS v4, Lucide Icons, Radix UI Popover, Node test runner (`node:test`, `@testing-library/react`).

**Spec:** [`docs/superpowers/specs/2026-10-16-category-custom-colors-design.md`](file:///D:/Center-Asset-Material-Management-System-main/docs/superpowers/specs/2026-10-16-category-custom-colors-design.md)

---

## Global Constraints

- **Accessibility Rule:** `❌ NEVER add color-only labels (always text + icon alongside color)` — badge must always render the dot, Tag icon, and Thai category name.
- **SSR & Theme Safety:** Never use client-side JavaScript theme detection (`isDark`) for badge rendering; use `text-foreground` and CSS `color-mix(in oklab, ${safeColor} 75%, var(--foreground))` to avoid hydration mismatches.
- **Strict Color Format:** Hex colors must be strictly 6-digit `#RRGGBB` (3-digit `#RGB` disallowed to ensure hex alpha appending `${safeColor}1A` remains valid 8-digit CSS hex color).
- **Flexbox Truncation:** The root `<span>` of `CategoryBadge` must use `max-w-full` without `shrink-0` so text truncation functions properly inside flex and table cell containers.
- **Cache Invalidation:** Any category mutation in `features/settings/actions.ts` or `postgres-actions.ts` must call `revalidatePath('/items')` alongside `revalidatePath('/settings')` and `revalidatePath('/', 'layout')`.
- **Dual Database Parity:** Supabase and Standalone Postgres must maintain 100% feature and projection parity for `category.color`.

---

## Review Focus

1. **Empty FormData String (`color: ""`):** When submitted without picking a color, `z.preprocess()` must normalize empty string to `undefined`, resolving to default `'#64748B'`.
2. **Invalid or Malformed Color Strings:** If a category in the database has an invalid or missing hex code, `CategoryBadge` must safely fallback to `'#64748B'` via regex validation.
3. **Table Column Overflow:** Long Thai category names (e.g. "ครุภัณฑ์วิทยาศาสตร์และการแพทย์") in the table must cleanly truncate without breaking column layouts at `w-44`.
4. **Standalone Postgres Join Projection:** `itemListColumns` and `itemBatchColumns` must emit `json_build_object('id', c.id, 'name', c.name, 'color', c.color)` so non-Supabase environments receive the color.
5. **Dark Mode Readability:** Badge text and icons must maintain WCAG 2.2 AA contrast in both light and dark modes against the tinted background.

---

### Task 1: Database Migration & Schema Alignment

**Files:**
- Create: `db/migrations/00042_add_color_to_categories.sql`
- Modify: `db/postgres/schema.ts:10-13`
- Modify: `features/settings/types.ts:1-8`
- Modify: `features/items/types.ts:11-15`

**Interfaces:**
- Produces: `public.categories.color` (`VARCHAR(7) NOT NULL DEFAULT '#64748B'`) in DB.
- Produces: `CategoryRow.color: string` in `features/settings/types.ts`.
- Produces: `ReferenceOption.color?: string` in `features/items/types.ts`.

- [x] **Step 1: Create SQL Migration file**

Create `db/migrations/00042_add_color_to_categories.sql`:
```sql
-- Migration: 00042_add_color_to_categories.sql
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#64748B';

COMMENT ON COLUMN public.categories.color IS 'HEX 6-digit color code for category badge (e.g. #3B82F6)';
```

- [x] **Step 2: Update Drizzle Schema in `db/postgres/schema.ts`**

In `db/postgres/schema.ts`, update `categories` table:
```typescript
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  description: text(),
  color: text().notNull().default('#64748B'),
  is_active: boolean().notNull().default(true),
  ...stamps(),
})
```

- [x] **Step 3: Update TypeScript Interfaces**

In `features/settings/types.ts`:
```typescript
export interface CategoryRow {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  updated_at: string
}
```

In `features/items/types.ts`:
```typescript
export interface ReferenceOption {
  id: string
  name: string
  color?: string
}
```

- [x] **Step 4: Verify schema syntax and type checking**

Run: `npm run typecheck`  
Expected: PASS with zero TypeScript errors.

- [x] **Step 5: Commit**

```bash
git add db/migrations/00042_add_color_to_categories.sql db/postgres/schema.ts features/settings/types.ts features/items/types.ts
git commit -m "feat(db): add color column to categories and update types"
```

---

### Task 2: Zod Validation Schema & Unit Tests

**Files:**
- Modify: `features/settings/schema.ts:25-35`
- Test: `features/settings/schema.test.ts`

**Interfaces:**
- Produces: `categorySchema` accepting `{ name, description?, color?, is_active }` and outputting `{ name: string, description: string | null, color: string, is_active: boolean }`.

- [x] **Step 1: Write failing unit tests for categorySchema color validation**

In `features/settings/schema.test.ts`, add:
```typescript
test('categorySchema validates and normalizes 6-digit hex color', () => {
  // 1. Valid lowercase hex converted to uppercase
  const validResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#3b82f6',
    is_active: 'true',
  })
  assert.equal(validResult.success, true)
  if (validResult.success) {
    assert.equal(validResult.data.color, '#3B82F6')
  }

  // 2. Empty string from FormData defaults to #64748B
  const emptyResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '',
    is_active: 'true',
  })
  assert.equal(emptyResult.success, true)
  if (emptyResult.success) {
    assert.equal(emptyResult.data.color, '#64748B')
  }

  // 3. Rejects 3-digit hex (#FFF)
  const threeDigitResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#FFF',
    is_active: 'true',
  })
  assert.equal(threeDigitResult.success, false)

  // 4. Rejects invalid hex characters (#GGGGGG)
  const invalidHexResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#GGGGGG',
    is_active: 'true',
  })
  assert.equal(invalidHexResult.success, false)
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test features/settings/schema.test.ts`  
Expected: FAIL (color not in schema or defaults not applied).

- [x] **Step 3: Implement color validation with `z.preprocess()` in `features/settings/schema.ts`**

In `features/settings/schema.ts`:
```typescript
const hex6ColorRegex = /^#[0-9A-Fa-f]{6}$/

export const categorySchema = z.object({
  name: requiredName,
  description: optionalText,
  color: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim()
        return trimmed === '' ? undefined : trimmed.toUpperCase()
      }
      return val
    },
    z
      .string()
      .regex(hex6ColorRegex, 'รหัสสีไม่ถูกต้อง (ต้องอยู่ในรูปแบบ HEX 6 หลัก เช่น #3B82F6)')
      .default('#64748B')
  ),
  is_active: checkboxBoolean,
})
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test features/settings/schema.test.ts`  
Expected: PASS all tests.

- [x] **Step 5: Commit**

```bash
git add features/settings/schema.ts features/settings/schema.test.ts
git commit -m "feat(settings): add 6-digit hex color validation to categorySchema"
```

---

### Task 3: Settings Server Actions & Cache Invalidation

**Files:**
- Modify: `features/settings/actions.ts:115-195`
- Modify: `features/settings/postgres-actions.ts:40-70`

**Interfaces:**
- Consumes: `categorySchema` with `color` field.
- Produces: Category insert/update operations containing `color` column and calling `revalidatePath('/items')`.

- [x] **Step 1: Update Supabase Category Actions in `features/settings/actions.ts`**

1. In `revalidateSettings()`:
```typescript
function revalidateSettings() {
  revalidateTag(CACHE_TAGS.categories)
  revalidatePath('/settings')
  revalidatePath('/items')
  revalidatePath('/', 'layout')
}
```

2. In `createCategory`:
Include `color: formData.get('color')` in `categorySchema.safeParse(...)`.

3. In `updateCategory`:
Include `color: formData.get('color')` in `categorySchema.safeParse(...)`.
In audit log old values check, select `'name, description, color, is_active'`.

- [x] **Step 2: Update Standalone Postgres Actions in `features/settings/postgres-actions.ts`**

In `mutatePostgresMetadata`:
1. When `kind === 'categories'`, parse `color: formData.get('color')`.
2. Ensure updated values include `color`.
3. Add `revalidatePath('/items')` alongside `revalidatePath('/settings')`.

- [x] **Step 3: Run settings queries test**

Run: `node --import tsx --test features/settings/queries.test.ts`  
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add features/settings/actions.ts features/settings/postgres-actions.ts
git commit -m "feat(settings): support color in category mutations and revalidate /items"
```

---

### Task 4: Item Queries & Projection Updates

**Files:**
- Modify: `features/items/queries.ts:45-75`
- Modify: `features/items/postgres-queries.ts:15-60`
- Test: `features/items/postgres-queries.test.ts`

**Interfaces:**
- Produces: `getItemReferences().categories` returning `ReferenceOption[]` with `color?: string`.
- Produces: `itemListColumns` and `itemBatchColumns` in `postgres-queries.ts` returning `category: { id, name, color }`.

- [x] **Step 1: Update Supabase `getCachedItemReferences` in `features/items/queries.ts`**

Change:
```typescript
supabase.from('categories').select('id, name, color').eq('is_active', true).order('name')
```
Verify that `getItems`, `getItemBatch`, and `getItemById` automatically hydrate rows with `catMap.get(row.category_id)` containing `color`.

- [x] **Step 2: Update Standalone Postgres queries in `features/items/postgres-queries.ts`**

1. In `itemListColumns`:
```typescript
case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'color', c.color) end as category,
```
2. In `itemBatchColumns`:
```typescript
case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'color', c.color) end as category,
```
3. In `getPostgresItemReferences`:
```typescript
const categories = await tx.execute<ReferenceOption & Record<string, unknown>>(
  sql`select id, name, color from public.categories where is_active order by name`
)
```

- [x] **Step 3: Run existing postgres query tests**

Run: `node --import tsx --test features/items/postgres-queries.test.ts`  
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add features/items/queries.ts features/items/postgres-queries.ts
git commit -m "feat(items): project category color in Supabase and Postgres queries"
```

---

### Task 5: UI Components & Component Tests

**Files:**
- Create: `features/items/components/category-badge.tsx`
- Create: `tests/component/category-badge.test.tsx`
- Create: `features/settings/components/category-color-picker.tsx`
- Modify: `features/settings/components/metadata-sections.tsx:140-195`
- Modify: `features/items/components/items-list-view.tsx:125-130,280-288`
- Modify: `features/items/components/items-grid-view.tsx`
- Modify: `features/items/components/item-inspector-drawer.tsx`
- Test: `tests/component/items-list-row.test.tsx`

**Interfaces:**
- Produces: `<CategoryBadge name={string} color={string | null | undefined} />`
- Produces: `<CategoryColorPicker defaultValue={string} name="color" />`

- [x] **Step 1: Write failing component test for `CategoryBadge`**

Create `tests/component/category-badge.test.tsx`:
```tsx
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { CategoryBadge } from '../../features/items/components/category-badge'

test('CategoryBadge: renders name, dot, and Tag icon with color styling', () => {
  const { container } = render(
    React.createElement(CategoryBadge, {
      name: 'ครุภัณฑ์คอมพิวเตอร์',
      color: '#3B82F6',
    })
  )

  // 1. Text is rendered
  assert.ok(screen.getByText('ครุภัณฑ์คอมพิวเตอร์'))

  // 2. Outer container has max-w-full and no shrink-0
  const badge = container.firstElementChild as HTMLElement
  assert.ok(badge.className.includes('max-w-full'))
  assert.ok(!badge.className.includes('shrink-0'))

  // 3. Dot is present
  const dot = badge.querySelector('span[aria-hidden="true"]')
  assert.ok(dot)
})

test('CategoryBadge: safely falls back to default #64748B when given invalid hex or null', () => {
  const { container } = render(
    React.createElement(CategoryBadge, {
      name: 'หมวดหมู่ทั่วไป',
      color: 'invalid-hex',
    })
  )

  const badge = container.firstElementChild as HTMLElement
  assert.ok(badge.getAttribute('style')?.includes('#64748B'))
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-badge.test.tsx`  
Expected: FAIL (Cannot find module `category-badge`).

- [x] **Step 3: Implement `CategoryBadge` in `features/items/components/category-badge.tsx`**

Implement strictly following the design specification:
- Outer `<span>` has `max-w-full`, **NO `shrink-0`**.
- Inner elements (dot and `Tag` icon) have `shrink-0`.
- Text has `truncate text-foreground font-medium`.
- Background style: `${safeColor}1A`, border style: `${safeColor}4D`.
- Icon color: `color-mix(in oklab, ${safeColor} 75%, var(--foreground))`.
- Fallback: `const safeColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#64748B'`.

- [x] **Step 4: Run `CategoryBadge` test to verify it passes**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-badge.test.tsx`  
Expected: PASS all tests.

- [x] **Step 5: Implement `CategoryColorPicker` in `features/settings/components/category-color-picker.tsx`**

1. Include 16 Tailwind/Government preset swatches:
   `#64748B`, `#EF4444`, `#F97316`, `#F59E0B`, `#10B981`, `#14B8A6`, `#06B6D4`, `#0EA5E9`,
   `#3B82F6`, `#6366F1`, `#8B5CF6`, `#A855F7`, `#D946EF`, `#EC4899`, `#F43F5E`, `#78716C`
2. Hidden input `<input type="hidden" name={name} value={color} />`
3. Native `<input type="color" value={color} onChange={...} />` for RGB wheel/custom picker.
4. Text input for direct hex editing.
5. Popover trigger showing color circle and hex code.

- [x] **Step 6: Integrate `CategoryColorPicker` into `features/settings/components/metadata-sections.tsx`**

In `CategorySection`:
- Add `CategoryColorPicker` to the create form grid.
- Add `CategoryColorPicker` to each category edit row with `defaultValue={category.color}`.

- [x] **Step 7: Update `items-list-view.tsx`, `items-grid-view.tsx`, and `item-inspector-drawer.tsx`**

1. In `features/items/components/items-list-view.tsx`:
   - Change table header: `<DataTableHead className={cn("hidden w-44 px-3", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")}>หมวดหมู่</DataTableHead>`
   - Change table cell: `<DataTableCell className={cn("hidden w-44 px-3 text-xs truncate", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")} title={item.category?.name}>`
   - Render `<CategoryBadge name={item.category.name} color={item.category.color} />` when `item.category` is present.
2. In `features/items/components/items-grid-view.tsx`:
   - Replace plain category text with `<CategoryBadge name={item.category.name} color={item.category.color} />`.
3. In `features/items/components/item-inspector-drawer.tsx`:
   - Render `<CategoryBadge name={item.category.name} color={item.category.color} />` in category row.

- [x] **Step 8: Run all component tests**

Run: `node --import tsx --max-old-space-size=2048 --test tests/component/category-badge.test.tsx tests/component/items-list-row.test.tsx`  
Expected: PASS all tests.

- [x] **Step 9: Commit**

```bash
git add features/items/components/category-badge.tsx tests/component/category-badge.test.tsx features/settings/components/category-color-picker.tsx features/settings/components/metadata-sections.tsx features/items/components/items-list-view.tsx features/items/components/items-grid-view.tsx features/items/components/item-inspector-drawer.tsx
git commit -m "feat(ui): add CategoryBadge and CategoryColorPicker with registry table integration"
```

---

### Task 6: Verification & Quality Gates

**Files:**
- N/A (Verification of entire branch)

- [x] **Step 1: Run complete test suite**

Run: `npm test`  
Expected: PASS all unit and component tests.

- [x] **Step 2: Run strict TypeScript typecheck**

Run: `npm run typecheck`  
Expected: PASS with zero unused variables and zero type errors.

- [x] **Step 3: Run ESLint**

Run: `npm run lint`  
Expected: PASS with zero lint warnings or errors.

- [x] **Step 4: Verify database migrations & readiness**

Run: `npm run verify-db-release`  
Expected: PASS with migration ledger and RLS verification confirmed.

- [x] **Step 5: Final commit if any polish made**

```bash
git commit --allow-empty -m "chore: verify category color wheel & registry badge quality gates pass"
```
