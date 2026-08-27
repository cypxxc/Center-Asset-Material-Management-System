# Permanent Item Deletion Design

## Goal

Remove the CAMMS trash workflow. Deleting an item permanently removes its database record and associated storage image, with no restore path in the application.

## Scope

- Replace soft-delete actions with direct database deletion for authorized users.
- Remove the trash navigation entry, trash route rendering, restore actions, and bulk trash actions.
- Remove existing soft-deleted item records and their storage images.
- Preserve audit logging for permanent deletion events.

## Authorization

Admins and staff retain the existing delete capability. The server action and RLS policy enforce permission; client visibility is not trusted. The new delete policy permits authorized direct deletion without requiring `deleted_at` to be set first.

## Delete Flow

1. The user confirms deletion in the existing item UI.
2. The server reads the authorized active item and its image URL.
3. The server permanently deletes the item record and writes a `hard_delete` audit event.
4. The server deletes the associated storage image after the database operation.
5. The item explorer, sidebar counts, dashboard data, and affected layout paths are revalidated.

If storage-image cleanup fails after the record is deleted, the action logs the failure without reporting that the database deletion failed. The image becomes an orphan that can be handled administratively.

## Migration

A new ordered migration will:

- Delete every existing `items` row with `deleted_at IS NOT NULL`.
- Replace the current DELETE RLS policy with an authorized admin/staff direct-delete policy.
- Remove trash-specific partial indexes where no longer useful.
- Update the sidebar statistics RPC so it no longer returns `trash_count`.

The migration changes production data permanently. It must be explicitly selected and applied through the project migration command only after a database backup has been verified.

## User Interface

- Remove Trash from the desktop sidebar and mobile drawer.
- Remove the `?deleted=true` branch and trash explorer route behavior from the item page.
- Remove restore and bulk-deletion controls.
- Keep the normal delete confirmation explicit that deletion is permanent.

## Verification

- Unit/integration-test direct deletion, role rejection, audit logging, and image cleanup behavior.
- Verify no trash route or navigation link remains.
- Run `npm test`, `npm run typecheck`, and `npm run lint`.
- Apply the selected migration to a non-production environment first and confirm previously deleted records are absent.

## Out of Scope

- Deleting audit logs
- Deleting backup data
- Changing category, location, unit, profile, or auth-user deletion behavior
