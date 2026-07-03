# Customizable Sidebar Drag & Drop Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Enable users to customize their sidebar menu order via drag-and-drop, persisting the order to their user profile.

**Architecture:** Use PostgreSQL `text[]` column to store the menu ordering array. Implement HTML5 drag-and-drop events in the `Sidebar` Client Component, executing optimistic UI sorting, and call a Server Action to save preferences to Supabase.

**Tech Stack:** Next.js 16 (React 19), Supabase PostgreSQL, Lucide React, Tailwind v4.

---

### Task 1: Database Migration & RLS Policy

**Files:**
- Create: `db/migrations/00019_add_sidebar_order_to_profiles.sql`

**Step 1: Create migration file**
Create the migration file and add the SQL code:
```sql
-- Migration 00019: Add sidebar_order and update own profile policy
ALTER TABLE public.profiles ADD COLUMN sidebar_order text[] DEFAULT NULL;

-- Enable users to update their own profile columns (sidebar_order and full_name)
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**Step 2: Run migration**
Run: `tsx scripts/apply-migrations.ts`
Expected: Migration executes successfully.

**Step 3: Commit**
```bash
git add db/migrations/00019_add_sidebar_order_to_profiles.sql
git commit -m "db: add sidebar_order column and RLS update policy for profiles"
```

---

### Task 2: Server Action for Sidebar Customization

**Files:**
- Modify: `features/auth/actions.ts`

**Step 1: Add Server Action code**
Add the `updateSidebarOrder` server action to the bottom of `features/auth/actions.ts`:
```typescript
export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const { error } = await supabase
    .from('profiles')
    .update({
      sidebar_order: order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'ไม่สามารถบันทึกลำดับเมนูได้: ' + error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
```

**Step 2: Verify type check**
Run: `npx tsc --noEmit`
Expected: Passes without errors.

**Step 3: Commit**
```bash
git add features/auth/actions.ts
git commit -m "feat: add updateSidebarOrder server action"
```

---

### Task 3: Sidebar Drag & Drop UI & Drag Handles

**Files:**
- Modify: `features/settings/types.ts`
- Modify: `components/layout/sidebar.tsx`

**Step 1: Add types**
Modify `features/settings/types.ts` to add `sidebar_order` to `ProfileRow`:
```typescript
export interface ProfileRow {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
  sidebar_order?: string[] | null
  created_at: string
  updated_at: string
}
```

And update `SidebarProps` type in `components/layout/sidebar.tsx` at line 29:
```typescript
interface SidebarProps {
  profile: {
    full_name: string
    email: string
    role: string
    sidebar_order?: string[] | null
  } | null
  // ...
```

**Step 2: Refactor `components/layout/sidebar.tsx` with Drag and Drop**
Add `GripVertical` icon to the imports.
Define the standard menu items map:
- `overview`
- `supplies`
- `assets`
- `locations`
- `reports`

Implement state:
```typescript
const [itemsOrder, setItemsOrder] = useState<string[]>(() => {
  return profile?.sidebar_order && profile.sidebar_order.length === 5
    ? profile.sidebar_order
    : ['overview', 'supplies', 'assets', 'locations', 'reports']
})
const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
```

Implement handlers:
- `onDragStart`
- `onDragOver`
- `onDragEnd`
- `onDrop`

Wrap each item in a container div with styling that changes when being dragged or hovered.
Call the `updateSidebarOrder` action on drop.

**Step 3: Run dev server and manually verify**
Run: `npm run dev`
Verify items can be dragged and dropped, order is saved, and is loaded on refresh.

**Step 4: Commit**
```bash
git add features/settings/types.ts components/layout/sidebar.tsx
git commit -m "feat: implement drag-and-drop customizable sidebar UI"
```
