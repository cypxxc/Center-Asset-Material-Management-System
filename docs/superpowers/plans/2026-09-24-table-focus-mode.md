# Table Focus Mode / Expanded Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement a responsive, accessible "Table Focus Mode" for CAMMS `ItemsExplorerClient` that temporarily expands the data workspace above the standard layout with small outer margin, dedicated scroll, toggle buttons, and complete state preservation.

**Architecture:** Extend `ItemsExplorerClient` with `isFocusMode` state. When active, transition the main table container into a fixed focused overlay (`fixed inset-2 md:inset-4 z-40 rounded-2xl shadow-2xl border border-border bg-card flex flex-col`) with a backdrop overlay behind it (`fixed inset-0 bg-background/80 backdrop-blur-sm z-30`). The table instance, DOM nodes, selection, filters, and virtualization window (`useItemWindow`) remain identical, ensuring 0 state loss or re-renders.

**Tech Stack:** React 19, Tailwind CSS, Lucide icons (`Maximize2`, `Minimize2`, `X`), Node test runner with React Testing Library.

## Global Constraints
- Do NOT replace or duplicate the existing table or virtualization logic.
- Preserve search, filters, selected rows, loaded window, pagination, and sorting 100%.
- Provide explicit toggle button (`Maximize2` / `Minimize2`), Close button (`X`), and `Escape` key dismissal.
- Prevent background body scrolling while focus mode is active with clean teardown.
- Pass `npm run typecheck` and component tests.

---

### Task 1: Component Tests for Table Focus Mode

**Files:**
- Modify: `tests/component/items-explorer-inspector.test.tsx`

- [x] **Step 1: Write tests for Table Focus Mode toggle, close button, Escape key, and state preservation**
- [x] **Step 2: Run test to confirm failure**

---

### Task 2: Implement Focus Mode in `ItemsExplorerClient`

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`

- [x] **Step 1: Add `isFocusMode` state, toggle button in header, and Escape key listener**
- [x] **Step 2: Apply conditional classes to `<main>` / table container for focused workspace**
- [x] **Step 3: Add background overlay and close button with proper ARIA attributes**
- [x] **Step 4: Lock body scroll when active and cleanup on unmount/close**
- [x] **Step 5: Verify component tests pass**

---

### Task 3: Quality Gates & Verification

- [x] **Step 1: Run `npm run typecheck`**
- [x] **Step 2: Run full test suite (`npm test`)**
- [x] **Step 3: Verify git diff is clean and concise**
