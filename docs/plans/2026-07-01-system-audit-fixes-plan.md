# System Audit Fixes Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement best practice resolutions for security, database, performance, and UX issues identified during the project audit.

**Architecture:** A phased, step-by-step update applying root middleware routing, RLS policy hardening, server action role validations, SQL aggregation queries, and responsive layouts.

**Tech Stack:** Next.js, Supabase, TypeScript, Tailwind CSS, PostgreSQL.

---

### Task 1: Add Next.js Root Middleware

**Files:**
- Create: `middleware.ts`

**Step 1: Write root middleware**
Create `middleware.ts` at the project root to forward requests to the Supabase session validation helper:
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

**Step 2: Run verify command**
Run `npm run build` to ensure the Next.js middleware compiles cleanly.

**Step 3: Commit**
```bash
git add middleware.ts
git commit -m "security: add next.js root middleware for session refresh"
```

---

### Task 2: Strengthen Audit Log RLS policy

**Files:**
- Create: `db/migrations/00010_fix_audit_log_policy.sql`

**Step 1: Write the migration**
Create the migration to add the `user_id = auth.uid()` verification check:
```sql
-- Migration 00010: Fix audit log RLS policy
begin;

drop policy if exists audit_logs_create on public.audit_logs;

create policy audit_logs_create on public.audit_logs 
  for insert to authenticated 
  with check (
    private.current_app_role() is not null 
    and user_id = auth.uid()
  );

commit;
```

**Step 2: Commit**
```bash
git add db/migrations/00010_fix_audit_log_policy.sql
git commit -m "security: restrict audit logs insert policy to authenticated caller uid"
```

---

### Task 3: Restrict Hard Delete Server Actions to Admins Only

**Files:**
- Modify: `features/items/actions.ts:491-532` & `features/items/actions.ts:534-560`

**Step 1: Update actions authorization validation**
Edit `hardDeleteItem` and `bulkHardDeleteItems` in `features/items/actions.ts`. Change authorization checks to verify that `profile.role === 'admin'`:
```typescript
// Replace requireEditor check with direct admin verification
const profile = await getCurrentProfile()
if (!profile || profile.role !== 'admin' || !profile.is_active) {
  return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบรายการถาวรได้' }
}
```

**Step 2: Run verification**
Run `npm test` to verify no schema parsing tests are broken.

**Step 3: Commit**
```bash
git add features/items/actions.ts
git commit -m "auth: restrict item hard delete actions to admin role only"
```

---

### Task 4: Fix SQL Query Console Client Context

**Files:**
- Modify: `features/admin/actions.ts:161-181`

**Step 1: Update runAdminSql client builder**
Modify `runAdminSql` in `features/admin/actions.ts` to call standard `createClient()` to preserve user session context during RPC call:
```typescript
export async function runAdminSql(sqlQuery: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient() // Preserves cookie session context
  const { data, error } = await supabase.rpc('exec_admin_sql', { sql_query: sqlQuery })

  if (error) {
    return { error: error.message }
  }

  // Log SQL execution in audit_logs
  await supabase.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'SQL_EXECUTE',
    target_table: 'multiple/raw_sql',
    new_data: { query: sqlQuery }
  })

  return data
}
```

**Step 2: Verify compilation**
Run `npm run build` to confirm everything builds successfully.

**Step 3: Commit**
```bash
git add features/admin/actions.ts
git commit -m "admin: fix sql console auth uid null issue by using user client session"
```

---

### Task 5: Add Database Foreign Key On Delete Cascade/Set Null

**Files:**
- Create: `db/migrations/00011_cascade_user_deletion.sql`

**Step 1: Write migration for foreign keys**
Drop existing restrictive foreign keys on `items` and add `ON DELETE SET NULL`:
```sql
-- Migration 00011: Cascade user deletion via set null
begin;

alter table public.items 
  drop constraint if exists items_created_by_fkey,
  drop constraint if exists items_updated_by_fkey,
  drop constraint if exists items_deleted_by_fkey;

alter table public.items
  add constraint items_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null,
  add constraint items_updated_by_fkey foreign key (updated_by) references public.profiles(id) on delete set null,
  add constraint items_deleted_by_fkey foreign key (deleted_by) references public.profiles(id) on delete set null;

commit;
```

**Step 2: Commit**
```bash
git add db/migrations/00011_cascade_user_deletion.sql
git commit -m "db: update profile foreign keys on items to on delete set null"
```

---

### Task 6: Implement Database-Side Query Aggregation

**Files:**
- Modify: `features/items/queries.ts` (`getSidebarData`)
- Modify: `features/reports/queries.ts` (`getReportStats`)

**Step 1: Refactor getSidebarData**
Rewrite `getSidebarData` in `features/items/queries.ts` to execute a single grouped database count or separate fast count queries instead of reading all items in memory.

**Step 2: Refactor getReportStats**
Rewrite `getReportStats` in `features/reports/queries.ts` to aggregate item counts/quantities directly database-side.

**Step 3: Run verify**
Verify types compile cleanly via `npm run build`.

**Step 4: Commit**
```bash
git add features/items/queries.ts features/reports/queries.ts
git commit -m "perf: aggregate item counts in database instead of next server memory"
```

---

### Task 7: Implement Responsive Mobile Hamburger Menu

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Add mobile menu component**
Add a stateful mobile slide-over drawer toggle (hamburger icon) in the Header component that displays sidebar links on screen sizes under 768px.

**Step 2: Verify responsive design**
Build the app using `npm run build`.

**Step 3: Commit**
```bash
git add components/layout/header.tsx
git commit -m "ux: implement mobile responsive hamburger menu to resolve layout lockout"
```

---

### Task 4: Fix Form Resubmit Modal and Double-Click Protection

**Files:**
- Modify: `features/items/components/item-form.tsx`
- Modify: `features/settings/components/metadata-sections.tsx`

**Step 1: Fix item-form validation error modal lock**
Refactor the item form modal to trigger on a boolean state that gets updated upon action response, rather than relying strictly on the string match block.

**Step 2: Add double submit disable state**
Add `disabled={pending}` using React forms pending status on submit buttons in settings metadata sections.

**Step 3: Commit**
```bash
git add features/items/components/item-form.tsx features/settings/components/metadata-sections.tsx
git commit -m "ux: add double submission protections and fix sticky item error modals"
```

---

### Task 9: CSV Parser quoted comma support and transaction atomicity

**Files:**
- Modify: `features/items/actions.ts` (`importItemsBulk`)

**Step 1: Refactor CSV splitter**
Replace `row.split(',')` with a CSV parse helper supporting quoted strings.

**Step 2: Wrap inserts in RPC database transaction**
Refactor imports to run through a database RPC to execute all inserts inside a single database transaction.

**Step 3: Run test suite**
Run `npm test` to verify validation and parsing tests pass.

**Step 4: Commit**
```bash
git add features/items/actions.ts
git commit -m "feat: upgrade csv parser to support quoted commas and transaction rollbacks"
```
