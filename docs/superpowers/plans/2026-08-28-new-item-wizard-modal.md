# New Item Wizard Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert inline new-item registration into an accessible two-step wizard without changing its server-side behavior.

**Architecture:** Keep `NewItemSheet` as the native-dialog and draft owner. Give `ItemForm` a display-step contract so it renders the current group of fields while retaining one HTML form, the existing `createItemInline` action, and all server validation.

**Tech Stack:** Next.js 16, React 19, TypeScript, native dialog, Zod, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-28-new-item-wizard-modal-design.md`

## Global Constraints

- Do not change schema, server actions, roles, RLS, audit payloads, asset-number rules, or `/items/new`.
- Preserve localStorage draft key `omni-asset:new-item-draft`, close confirmation, Escape/backdrop behavior, and list refresh on success.
- Required Step 1 fields are item name, item type, quantity, and unit.
- Keep the native dialog and accessible keyboard operation.

---

### Task 1: Add Step-Aware Form Rendering

**Files:**

- Modify: `features/items/components/item-form.tsx`
- Test: `tests/component/new-item-sheet.test.tsx`

**Interfaces:**

- Consumes: `wizardStep?: 1 | 2` from `NewItemSheet`.
- Produces: one form whose Step 1 has type, item name, quantity, unit, category, and location; Step 2 has asset/detail, price, responsible person, status, image, note, and depreciation controls.

- [ ] **Step 1: Write failing component assertions**

Add a rendered-sheet test with `wizardStep={1}` that expects `input[name="item_name"]`, `input[name="quantity"]`, `select[name="unit_id"]`, and `select[name="location_id"]`, then asserts `input[name="serial_no"]` is absent. Add `wizardStep={2}` assertions that serial, image, note, and the final submit button are present.

- [ ] **Step 2: Run the focused test**

```powershell
node --import tsx --test tests/component/new-item-sheet.test.tsx
```

Expected: FAIL because `ItemForm` has no step boundary.

- [ ] **Step 3: Add the `wizardStep` prop and group fields**

Extend `ItemFormProps`:

```ts
wizardStep?: 1 | 2
```

Default it to `undefined`. When it is undefined, preserve the standalone current layout. When it is `1`, render the type tabs, hidden `item_type`, item name, category, quantity, unit, and location. When it is `2`, render the asset/material conditional fields, unit price, responsible person, status, image, note, and depreciation controls. Keep every control inside the single form so drafts and final `FormData` stay unchanged.

- [ ] **Step 4: Re-run focused tests**

```powershell
node --import tsx --test tests/component/new-item-sheet.test.tsx
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add features/items/components/item-form.tsx tests/component/new-item-sheet.test.tsx
git commit -m "feat: split item form into wizard steps"
```

### Task 2: Add Wizard Navigation and Persistent Footer

**Files:**

- Modify: `features/items/components/new-item-sheet.tsx`
- Modify: `features/items/components/item-form.tsx`
- Test: `tests/component/new-item-sheet.test.tsx`

**Interfaces:**

- Consumes: `wizardStep`, `requestSubmit()`, and the existing native dialog/draft lifecycle.
- Produces: a `NewItemSheet` with `currentStep: 1 | 2`, `goNext()`, and a fixed footer with next/back/draft/submit controls.

- [ ] **Step 1: Write failing wizard tests**

Add tests that:

```ts
fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
assert.equal(screen.getByText('2 จาก 2').textContent, '2 จาก 2')
fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }))
assert.equal((document.querySelector('input[name="item_name"]') as HTMLInputElement).value, 'Desk')
```

Add invalid-step test: leave `item_name` empty, click `ถัดไป`, assert progress remains `1 จาก 2` and the name input is focused.

- [ ] **Step 2: Run the focused test**

```powershell
node --import tsx --test tests/component/new-item-sheet.test.tsx
```

Expected: FAIL because the modal has no step state or navigation.

- [ ] **Step 3: Implement navigation without duplicating submission**

In `NewItemSheet`, add `const [currentStep, setCurrentStep] = useState<1 | 2>(1)`; reset it to 1 whenever the dialog opens. Implement `goNext` by finding the dialog form and calling `checkValidity()`; if invalid, call `reportValidity()` and focus the first `:invalid` control, otherwise set step 2. Pass `wizardStep={currentStep}` to `ItemForm`.

Render progress with `aria-live="polite"` and text `1 จาก 2` or `2 จาก 2`. Move actions to a sibling footer under the scroll body: Step 1 exposes `ยกเลิก` and `ถัดไป`; Step 2 exposes `ย้อนกลับ`, `บันทึกร่าง`, and a submit button associated with the form via its `id`. The draft button calls the existing `saveDraft(dialog)` and does not close the dialog.

- [ ] **Step 4: Make the footer mobile-persistent**

Give the panel a column layout, keep only `.new-item-sheet-body` scrollable, and use `.new-item-sheet-footer { flex-shrink: 0; border-top: 1px solid #e2e8f0; }`. At mobile sizes use `width: min(100%, 760px)` and `max-height: calc(100dvh - 16px)`. Preserve native dialog backdrop and focus behavior.

- [ ] **Step 5: Re-run component and integration coverage**

```powershell
node --import tsx --test tests/component/new-item-sheet.test.tsx tests/integration/create-item-inline.test.ts
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add features/items/components/new-item-sheet.tsx features/items/components/item-form.tsx tests/component/new-item-sheet.test.tsx
git commit -m "feat: add two-step new item wizard"
```

### Task 3: Release Validation

**Files:**

- Test: `tests/component/new-item-sheet.test.tsx`, `tests/integration/create-item-inline.test.ts`

- [ ] **Step 1: Run the complete code-quality gates**

```powershell
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run browser smoke coverage**

```powershell
npm run test:smoke
```

Expected: smoke suite passes against the production build.

- [ ] **Step 3: Commit final verified changes**

```powershell
git status --short
git add features/items/components/new-item-sheet.tsx features/items/components/item-form.tsx tests/component/new-item-sheet.test.tsx
git commit -m "fix: verify new item wizard release gates"
```

## Plan Self-Review

- Spec coverage: Task 1 supplies the step field boundary; Task 2 supplies navigation, validation, drafts, responsive persistent footer, and unchanged submit behavior; Task 3 validates release gates.
- No placeholder scan: every task supplies named files, commands, expected results, and implementation detail.
- Type consistency: `wizardStep` is optional so the standalone item route retains its existing form behavior, while the modal owns the `1 | 2` state.

