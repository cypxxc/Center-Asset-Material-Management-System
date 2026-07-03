# Design Document: System Audit Fixes

This document outlines the design and best practices for addressing the security, performance, logic, and UX/UI defects identified in the system audit.

---

## Phase 1: Critical Security & Session Fixes

### 1. Root Next.js Middleware
* **Approach**: Create `middleware.ts` in the project root. This ensures that every HTTP request to protected dashboard paths executes the Supabase session validation and token-refresh helper.
* **File**: `[NEW]` [middleware.ts](file:///d:/registry-s/middleware.ts)
* **Code**:
  ```typescript
  import { type NextRequest } from 'next/server'
  import { updateSession } from '@/lib/supabase/middleware'

  export async function middleware(request: NextRequest) {
    return await updateSession(request)
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```

### 2. Audit Log RLS Policy Strengthening
* **Approach**: Strengthen the RLS insert policy for `audit_logs` to ensure that authenticated clients can only insert rows where the `user_id` matches their own `auth.uid()`.
* **Migration File**: `[NEW]` [00010_fix_audit_log_policy.sql](file:///d:/registry-s/db/migrations/00010_fix_audit_log_policy.sql)
* **SQL**:
  ```sql
  drop policy if exists audit_logs_create on public.audit_logs;
  create policy audit_logs_create on public.audit_logs 
    for insert to authenticated 
    with check (
      private.current_app_role() is not null 
      and user_id = auth.uid()
    );
  ```

### 3. Hard Delete Action RBAC Restriction
* **Approach**: Restrict the `hardDeleteItem` and `bulkHardDeleteItems` server actions in `features/items/actions.ts` to `admin` role only.
* **Code Modification**:
  ```typescript
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบรายการถาวรได้' }
  }
  ```

---

## Phase 2: Admin Panel & Database Fixes

### 1. SQL Query Console Client Context
* **Approach**: Change `runAdminSql` in `features/admin/actions.ts` to execute RPC calls via standard client `createClient()` instead of `createAdminClient()`. Because the `exec_admin_sql` database function is defined as `SECURITY DEFINER`, it will execute the raw SQL as a superuser but properly inspect `auth.uid()` from the client cookie context to verify authorization.
* **Code**:
  ```typescript
  const supabase = await createClient() // Preserves user session context
  const { data, error } = await supabase.rpc('exec_admin_sql', { sql_query: sqlQuery })
  ```

### 2. Database Cascade Deletions
* **Approach**: Modify foreign keys on `items` (`created_by`, `updated_by`, `deleted_by`) referencing `profiles` to use `ON DELETE SET NULL`. This allows deleting user profiles without breaking database constraints or losing audit history.
* **Migration File**: `[NEW]` [00011_cascade_user_deletion.sql](file:///d:/registry-s/db/migrations/00011_cascade_user_deletion.sql)

### 3. Trigram Index Matching
* **Approach**: Update search query in `features/items/queries.ts` to query against a concatenated text expression matching the Trigram GIN index `idx_items_trgm_search` so PostgreSQL can optimize queries using index scans.

---

## Phase 3: Performance Aggregations

### 1. Database-Side Aggregate Statistics
* **Approach**: Instead of fetching all items over the network, query aggregated counts directly from PostgreSQL. We will write aggregated SQL queries in `queries.ts` using `.select('item_type, status', { count: 'exact' })` and group them database-side.
* **Methods to Refactor**:
  * `getSidebarData` in `features/items/queries.ts`
  * `getReportStats` in `features/reports/queries.ts`

---

## Phase 4: UI/UX & Responsive Layouts

### 1. Responsive Mobile Navigation Menu
* **Approach**: Add a responsive mobile menu toggle (hamburger button) to `components/layout/header.tsx` and a slide-out drawer containing navigation items for screens under 768px.
* **Styling**: Vanilla CSS and clean JSX Tailwind transitions.

### 2. Form Resubmission Prevention
* **Approach**: Disable submit buttons on settings metadata and item forms while submission status is pending using React's `useFormStatus` or local state.
* **Reset blocked error state**: Refactor item form error state handling to clear `dismissedMsg` when inputs change.

### 3. CSV Import Parsing & Transactions
* **Approach**: Use a regex-based CSV splitter that handles nested double quotes and commas correctly. Wrap database inserts in a single transaction/RPC to guarantee database atomicity on failure.
