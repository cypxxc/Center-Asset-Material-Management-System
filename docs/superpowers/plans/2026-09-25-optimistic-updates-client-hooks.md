# Optimistic Updates & Client Hook Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable instant optimistic UI updates on item mutations (bulk update, bulk delete, single item delete) integrated with `useItemsFilter` and `ItemBatchWindow` without waiting for round-trip network delays.

**Architecture:** 
1. Add optimistic update methods (`optimisticDelete(ids: string[])`, `optimisticUpdate(ids: string[], updates: Partial<ItemListRow>)`) to `ItemBatchWindow` in `features/items/batch-window.ts` so the virtualized window store immediately mutates in-memory slots and re-publishes state to subscribers.
2. In `app/(dashboard)/items/items-explorer-client.tsx`, connect `BulkEditDialog` save, bulk delete, and inline edit workflows with `store.optimisticUpdate` and `store.optimisticDelete`. If the server action fails, immediately rollback via `store.refresh()`.
3. In `features/items/components/delete-item-button.tsx`, replace blocking `alert()` with modern notification and navigation transition.
4. Add comprehensive unit and integration tests verifying optimistic mutations and rollback on failure.

**Tech Stack:** Next.js 15, React 19 Client Components, TypeScript, `useSyncExternalStore`, Node:test.

## Global Constraints
- Do not break virtual scrolling bounds or batch pagination cursors in `ItemBatchWindow`.
- Ensure clean rollback if server action fails or throws an exception.
- Preserve all existing tests and passing test suite: `npm test`.

---

### Task 1: Optimistic Mutations in `ItemBatchWindow`

**Files:**
- Modify: `features/items/batch-window.ts`
- Test: `tests/unit/item-batch-window-optimistic.test.ts`

**Interfaces:**
- Consumes: `ItemListRow`, `WindowState`, `BatchSlot`
- Produces: 
  - `store.optimisticDelete(ids: string[])`: removes items from batches, decrements `total`, and notifies subscribers.
  - `store.optimisticUpdate(ids: string[], updates: Partial<ItemListRow>)`: merges updates into matching item records across batches, and notifies subscribers.
  - `store.rollback(previousState: WindowState)`: restores previous snapshot if mutation fails.

- [ ] **Step 1: Write unit tests for optimistic mutation methods**

Create `tests/unit/item-batch-window-optimistic.test.ts` testing:
1. `optimisticDelete` removes items with matching ids and updates batch lengths and totals.
2. `optimisticUpdate` updates matching items' properties without altering unaffected fields.
3. `rollback` restores snapshot on demand.

- [ ] **Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/unit/item-batch-window-optimistic.test.ts`

- [ ] **Step 3: Implement optimistic methods in `ItemBatchWindow`**

In `features/items/batch-window.ts`:
- Add `optimisticDelete(ids: string[]): WindowState`
- Add `optimisticUpdate(ids: string[], patch: Partial<ItemListRow>): WindowState`
- Add `rollback(snapshot: WindowState): void`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/unit/item-batch-window-optimistic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/items/batch-window.ts tests/unit/item-batch-window-optimistic.test.ts
git commit -m "feat(items): add optimistic mutation and rollback methods to ItemBatchWindow"
```

---

### Task 2: Integrate Optimistic Updates in `ItemsExplorerClient`

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Test: `tests/integration/items-explorer-optimistic.test.ts`

**Interfaces:**
- Consumes: `store.optimisticDelete`, `store.optimisticUpdate`, `store.rollback` from `useItemWindow`
- Produces: Instant list update on bulk edit and bulk delete with automatic rollback on error.

- [ ] **Step 1: Write integration tests for optimistic UI interaction**

Create `tests/integration/items-explorer-optimistic.test.ts` testing:
1. Bulk edit immediately reflects changes locally and confirms with server.
2. Bulk delete immediately removes selected rows locally and confirms with server.
3. Errors trigger rollback and show blocking error.

- [ ] **Step 2: Run test to verify initial state**

Run: `node --import tsx --test tests/integration/items-explorer-optimistic.test.ts`

- [ ] **Step 3: Update `ItemsExplorerClient` with optimistic handlers**

In `app/(dashboard)/items/items-explorer-client.tsx`:
- When bulk edit is submitted, apply `store.optimisticUpdate` before/during `bulkUpdateItems`. If server returns error, call `store.rollback(snapshot)`.
- When bulk delete is clicked, apply `store.optimisticDelete` before/during `bulkHardDeleteItems`. If server returns error, call `store.rollback(snapshot)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/items-explorer-optimistic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/items/items-explorer-client.tsx tests/integration/items-explorer-optimistic.test.ts
git commit -m "feat(items): apply optimistic updates in ItemsExplorerClient for bulk operations"
```

---

### Task 3: Improve DeleteItemButton UX and Navigation

**Files:**
- Modify: `features/items/components/delete-item-button.tsx`
- Test: `tests/unit/delete-item-button.test.ts`

**Interfaces:**
- Consumes: `hardDeleteItem`, `useRouter`
- Produces: Non-blocking delete confirmation with immediate redirect and feedback.

- [ ] **Step 1: Write test for DeleteItemButton component logic**

Create `tests/unit/delete-item-button.test.ts` testing:
- Successful delete invokes redirect without browser `alert()`.
- Unsuccessful delete shows error without crashing.

- [ ] **Step 2: Update `features/items/components/delete-item-button.tsx`**

Replace `alert()` with toast / error state and `router.push('/items')` on success.

- [ ] **Step 3: Run test to verify it passes**

Run: `node --import tsx --test tests/unit/delete-item-button.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add features/items/components/delete-item-button.tsx tests/unit/delete-item-button.test.ts
git commit -m "feat(items): improve DeleteItemButton with router transition and clean feedback"
```

---

### Task 4: Full Test Suite Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 100% PASS across all suites.
