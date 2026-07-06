# Standard New Item Dialog Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the animated new-item sheet with a standard centered dialog and preserve unfinished new-item form input as a draft.

**Architecture:** Keep `NewItemSheet` as the existing integration point, but change its presentation from a slide-in side sheet to a centered modal with no transition. Drafts are stored in `localStorage` from form fields inside the dialog, restored when the dialog opens, and cleared after successful create.

**Tech Stack:** React 19 client component, native `<dialog>`, browser `localStorage`, node:test with Testing Library.

---

### Task 1: Tests First

**Files:**
- Modify: `tests/component/new-item-sheet.test.tsx`

- [ ] **Step 1: Add standard dialog test**

Assert that the rendered dialog style does not contain transition/transform-based sheet behavior and uses centered modal CSS.

- [ ] **Step 2: Add draft restore test**

Seed `localStorage` with `{ item_name: "Draft Chair" }`, open the dialog, and assert the item name input receives that value.

- [ ] **Step 3: Add draft save test**

Type in the item name input and assert `localStorage` stores the draft.

- [ ] **Step 4: Verify red**

Run `npm test -- tests/component/new-item-sheet.test.tsx`; expected to fail until the component implements standard dialog and draft support.

### Task 2: Component Implementation

**Files:**
- Modify: `features/items/components/new-item-sheet.tsx`

- [ ] **Step 1: Remove slide transition lifecycle**

Use `dialog.showModal()` when `open` becomes true and `dialog.close()` when false. Remove `data-open`, `requestAnimationFrame`, and `transitionend` logic.

- [ ] **Step 2: Implement draft storage**

Use a stable localStorage key, save named input/select/textarea values on input/change, restore values after form mount, and clear the draft on successful create.

- [ ] **Step 3: Replace CSS**

Make `.new-item-sheet-dialog` a centered flex modal and `.new-item-sheet-panel` a fixed-size standard dialog without transition/transform/will-change.

### Task 3: Verification

**Files:**
- No production file changes beyond Task 2.

- [ ] **Step 1: Run focused test**

Run `npm test -- tests/component/new-item-sheet.test.tsx`.

- [ ] **Step 2: Run full checks**

Run `npm test`, `npm run lint`, and `npm run build`.
