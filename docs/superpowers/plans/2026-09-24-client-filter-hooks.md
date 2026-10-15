# Client Filter & Pagination Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract reusable client filter and query-synchronization hooks (`useAuditLogsFilter`, `useUsersFilter`, and `useItemsFilterSync`) to eliminate repetitive URLSearchParams boilerplate and standardize optimistic/transition filter handling across CAMMS explorer clients.

**Architecture:** Create modular, typed React hooks under each feature domain (`features/admin/hooks/` and `features/items/hooks/`) that manage local draft filter state, URL synchronization via Next.js router transitions, and reset logic. Validate logic with unit and component tests before integration into client pages.

**Tech Stack:** Next.js App Router, React 19 (`useTransition`, `useState`), TypeScript, Node test runner (`node:test`).

## Global Constraints

- Preserve all existing query parameter keys and default behaviors.
- Ensure strict TypeScript compliance (`npm run typecheck` passes with no unused locals/parameters).
- Follow TDD: write tests first, verify red, implement green, refactor, and verify no regressions.
- No changes to user-facing functionality or breaking parameter contracts.

---

### Task 1: Audit Logs Filter Hook (`useAuditLogsFilter`)

**Files:**
- Create: `features/admin/hooks/use-audit-logs-filter.ts`
- Test: `tests/unit/use-audit-logs-filter.test.ts`
- Modify: `app/(dashboard)/admin/audit-logs/audit-logs-client.tsx`

**Interfaces:**
- Produces: `useAuditLogsFilter(initialSearchParams, pathname, router, startTransition)` returning `{ searchTerm, setSearchTerm, selectedAction, setSelectedAction, selectedTable, setSelectedTable, applyFilters, handleSearchSubmit, handleResetFilters }`

- [ ] **Step 1: Write unit test for audit logs filter URL generation and state transitions**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `useAuditLogsFilter` hook**
- [ ] **Step 4: Verify test passes**
- [ ] **Step 5: Refactor `audit-logs-client.tsx` to use `useAuditLogsFilter` and verify typecheck & tests**

---

### Task 2: Users Filter Hook (`useUsersFilter`)

**Files:**
- Create: `features/admin/hooks/use-users-filter.ts`
- Test: `tests/unit/use-users-filter.test.ts`
- Modify: `app/(dashboard)/admin/users/users-client.tsx`

**Interfaces:**
- Produces: `useUsersFilter(initialSearchParams, pathname, router, startTransition)` returning `{ searchTerm, setSearchTerm, selectedRole, setSelectedRole, selectedStatus, setSelectedStatus, applyFilters, handleSearchSubmit, handleResetFilters }`

- [ ] **Step 1: Write unit test for users filter URL generation**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `useUsersFilter` hook**
- [ ] **Step 4: Verify test passes**
- [ ] **Step 5: Refactor `users-client.tsx` to use `useUsersFilter` and verify typecheck & tests**

---

### Task 3: Verification & Quality Gate

- [ ] **Step 1: Run typecheck (`npm run typecheck`)**
- [ ] **Step 2: Run full test suite (`npm test`)**
- [ ] **Step 3: Check git status and commit clean changes**
