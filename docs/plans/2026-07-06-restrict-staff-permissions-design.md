# Restrict Staff Permissions Design

**Goal:** Restrict delete, trash management, and settings management capabilities to the `admin` role, preventing `staff` from performing these operations.

## Architecture & Layers

We enforce permission restrictions across all three layers (Defense-in-depth):

1. **UI Layer:** Update helpers in `lib/permissions.ts` to return `false` for `staff` role.
2. **Application Layer:** Update Server Actions in `features/items/actions.ts` and `features/settings/actions.ts` to enforce `admin` role.
3. **Database Layer:** Deploy a database migration to update RLS policies for `categories`, `locations`, `units`, and `items` so that only `admin` has insert/update/delete rights on metadata and delete/restore rights on items.

## Detailed Changes

### 1. UI Permissions Helper (`lib/permissions.ts`)
Update `canDelete`, `canManageSettings`, and `canManageTrash` to only return `true` when the role is `'admin'`.

### 2. Server Actions (`features/items/actions.ts`, `features/settings/actions.ts`)
* In `features/items/actions.ts`:
  * `requireDeletePermission` -> enforce `role === 'admin'`.
  * `softDeleteItem` -> check `profile.role === 'admin'`.
  * `bulkDeleteItems` -> check `profile.role === 'admin'`.
  * `restoreItem` -> change check from `requireEditor` to `requireDeletePermission`.
  * `bulkRestoreItems` -> change check from `requireEditor` to `requireDeletePermission`.
* In `features/settings/actions.ts`:
  * `requireSettingsManager` -> enforce `role === 'admin'`.

### 3. Database RLS (`db/migrations/00022_restrict_staff_permissions.sql`)
Revert metadata change permissions from `00018` for `staff`:
* Drop `categories_staff_manage`, `locations_staff_manage`, `units_staff_manage`.
* Drop `items_hard_delete`.
* Create `categories_admin_manage`, `locations_admin_manage`, `units_admin_manage` policies checking for `'admin'` role only.
* Create `items_hard_delete` policy checking for `'admin'` role only.
