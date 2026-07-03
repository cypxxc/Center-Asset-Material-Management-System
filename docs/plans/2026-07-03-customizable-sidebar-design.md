# Design Document: Customizable Sidebar via Drag & Drop

This document outlines the design and implementation details for adding drag-and-drop customization to the main navigation of the Sidebar. The custom order will be persisted per user in the database.

---

## 1. Database Migration

* **Goal**: Add a `sidebar_order` column to store the menu ordering for each user, and update RLS policies to allow users to save their preferences.
* **Migration File**: `[NEW]` [00019_add_sidebar_order_to_profiles.sql](file:///d:/registry-s/db/migrations/00019_add_sidebar_order_to_profiles.sql)
* **SQL Implementation**:
  ```sql
  -- Add sidebar_order column to store array of menu keys
  ALTER TABLE public.profiles ADD COLUMN sidebar_order text[] DEFAULT NULL;

  -- Add RLS policy allowing authenticated users to update their own profile row
  -- This enables updating both profile settings (e.g. full_name) and sidebar_order
  CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  ```

---

## 2. Server Action

* **Goal**: Expose an API for the Client Component to save the custom menu order.
* **File**: `[MODIFY]` [actions.ts](file:///d:/registry-s/features/auth/actions.ts)
* **Code Implementation**:
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

---

## 3. Sidebar Drag & Drop UI/UX

* **Goal**: Render the sidebar navigation dynamically and handle the drag-and-drop interactions.
* **File**: `[MODIFY]` [sidebar.tsx](file:///d:/registry-s/components/layout/sidebar.tsx)
* **Implementation Details**:
  * **Default Order**: `['overview', 'supplies', 'assets', 'locations', 'reports']`
  * **Dynamic Mapping**: Group each nav item block into a map and render them in the order specified by a state array `itemsOrder`.
  * **Initialization**: Initialize `itemsOrder` with `profile.sidebar_order` if present; otherwise, fall back to the default order.
  * **Drag and Drop Event Handlers**:
    - `draggable={true}` on each draggable navigation container wrapper.
    - `onDragStart` to store the index of the dragged item and apply styling (e.g. opacity-50, border-dashed).
    - `onDragOver` to handle sorting dynamically as the user drags (providing an **Optimistic UI** feel, updating the state locally for smooth, instant feedback).
    - `onDragEnd` to clear drag states.
    - `onDrop` to finalize the order and trigger the server action `updateSidebarOrder` to persist it.
  * **Visual Enhancements**:
    - Render a subtle `GripVertical` icon (visible on hover) to indicate the item is draggable.
    - Style the item with scale transitions and shadows during dragging.

---

## 4. Verification Plan

### Automated Tests
- Validate database migration executes successfully.
- Verify server action handles authentication correctly (rejects anonymous requests, saves data for logged-in users).

### Manual Verification
- Log in as a user, drag/drop menu items (e.g. move "Assets" to the top).
- Verify reordering is immediate and matches the hover state.
- Refresh the page and verify the custom order is loaded correctly from the profile.
- Log in as a different user and verify they see their own custom order (or the default order if not customized).
