# Registry-S Supabase Design

## Decision

Use the confirmed empty `inve` Supabase project as the Registry-S backend. Replace its incompatible legacy tables in the `public` schema rather than adapting the application to their bigint and varchar identifiers.

## Data Model

`auth.users` is the identity source of truth. `public.profiles` stores the application role (`admin`, `staff`, `viewer`) and active state. The Registry-S domain uses `categories`, `locations`, `units`, `items`, and `audit_logs`; all identifiers are UUIDs.

## Migration Strategy

Drop only the verified-empty legacy tables and legacy enum types, then create the Registry-S schema and supporting indexes. Create a hardened `private.get_my_role()` helper for RLS policies. The signup trigger always assigns `viewer`; seed accounts receive elevated roles through an explicit update, never client-editable user metadata.

## Access Model

All public tables use RLS. Authenticated users can read active metadata and non-deleted items. Staff can create and update non-deleted items. Admins manage metadata, users, and soft-delete items. The storage bucket is private and its object policies follow the same role rules.

## Verification

Verify the resulting tables, RLS state, Storage bucket, Auth accounts, profile roles, and password login. Configure local `.env.local` with the project URL and publishable key; retain the existing service-role key only if an admin API check proves it belongs to this project.
