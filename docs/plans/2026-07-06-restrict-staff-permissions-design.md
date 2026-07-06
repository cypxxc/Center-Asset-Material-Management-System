# Staff Operational Admin Permissions Design

**Goal:** Allow `staff` to perform the same operational asset-management work as `admin`, while keeping true administrative controls restricted to `admin`.

## Permission Boundary

`staff` is allowed to:
- Create, update, soft-delete, restore, and hard-delete items.
- Manage trash.
- Manage settings metadata: categories, locations, and units.
- Use operational bulk actions and item import/export flows that already allow editor-level users.

`staff` is not allowed to:
- Access the admin DB panel.
- Run admin SQL or database maintenance actions in `features/admin/actions.ts`.
- Edit user roles or active status through `updateProfile`.
- Use service-role or Supabase Auth administration operations directly.

## Architecture & Layers

We enforce this boundary across three layers:

1. **UI Layer:** `lib/permissions.ts` returns `true` for `staff` on operational helpers such as delete, settings metadata management, and trash management.
2. **Application Layer:** Server Actions allow `admin` and `staff` for operational item/settings metadata changes. Admin-only actions keep using `requireAdmin()`.
3. **Database Layer:** RLS policies for metadata management and item hard-delete allow `admin` and `staff`. Profile management and admin DB surfaces remain admin-only.

## Detailed Changes

### UI Permissions Helper (`lib/permissions.ts`)

`canDelete`, `canManageSettings`, and `canManageTrash` return `true` for both `admin` and `staff`.

### Server Actions

In `features/items/actions.ts`, delete, restore, and hard-delete flows allow `admin` and `staff`.

In `features/settings/actions.ts`, `requireSettingsManager()` allows `admin` and `staff` for metadata management. `requireAdmin()` remains admin-only and continues to guard `updateProfile`.

### Database RLS (`db/migrations/00022_restrict_staff_permissions.sql`)

Metadata policies for `categories`, `locations`, and `units`, plus the `items_hard_delete` policy, allow `private.current_app_role() IN ('admin', 'staff')`.

Admin-only policies for profile/user management and DB administration are not relaxed.
