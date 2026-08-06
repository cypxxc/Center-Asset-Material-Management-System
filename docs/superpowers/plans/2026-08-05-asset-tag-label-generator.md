# Public Read-Only Asset Scanning & QR Code Generator Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable public, unauthenticated read-only viewing of asset details when scanning physical QR codes on mobile phones. Scanning opens a clean public asset card without login. Editing/managing requires staff login.

**Architecture:**
1. Update `app/(dashboard)/layout.tsx` to permit unauthenticated rendering specifically on `/items/[id]` routes with a standalone public header layout.
2. Update `app/(dashboard)/items/[id]/page.tsx` to conditionally render a read-only Public Asset Card when `!profile` (hiding edit/delete/audit actions, adding "เข้าสู่ระบบเพื่อจัดการ" button).
3. Verify public read capability in `getItemById(id)` query using RLS-respecting client.
4. Verify using test suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).

---

### Task 1: Public Route Handling in Dashboard Layout

**Files:**
- `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update `DashboardLayout` to check if request is for public route `/items/[id]`**
  If `!profile` and the user is visiting an item detail page, bypass login redirect and render children with a public header shell.
- [ ] **Step 2: Verify other routes (`/dashboard`, `/items`, `/settings`) remain strictly guarded**

---

### Task 2: Public Read-Only View in Item Detail Page

**Files:**
- `app/(dashboard)/items/[id]/page.tsx`
- Create/Modify: `app/(dashboard)/items/[id]/public-item-view.tsx`

- [ ] **Step 1: Create `PublicItemView` component**
  Clean mobile-optimized read-only card displaying item details, location, status badge, image, and "เข้าสู่ระบบเพื่อจัดการ (สำหรับเจ้าหน้าที่)" button.
- [ ] **Step 2: Integrate into `app/(dashboard)/items/[id]/page.tsx`**
  When `!profile`, render `PublicItemView`. When `profile`, render full management view.
- [ ] **Step 3: Test guest and authenticated rendering**

---

### Task 3: Full Verification & Code Quality Audit

- [ ] **Step 1: Run unit and component test suite**
  Run: `npm test`
- [ ] **Step 2: Run strict TypeScript check**
  Run: `npm run typecheck`
- [ ] **Step 3: Run ESLint**
  Run: `npm run lint`
- [ ] **Step 4: Run production build**
  Run: `npm run build`
