# Audit Log Display Design

## Context

Registry-S has two audit-log display surfaces that expose raw database-oriented values:

- `app/(dashboard)/admin/db-panel/db-panel-client.tsx` renders `audit_logs.old_data` and `audit_logs.new_data` as truncated JSON strings in the database panel.
- `app/(dashboard)/items/[id]/page.tsx` renders item history diffs with raw database field names such as `unit_price`, `status`, and `updated_at`.

The current behavior is difficult for Thai-first administrative users to scan. Long JSON values are cut off in the table, and item history can make the detail page too long when an item has many audit entries.

## Goals

- Make audit-log details readable without copying JSON out of the UI.
- Use Thai labels for actions, target tables, field names, and known enum values.
- Keep the DB Panel information dense and Explorer-like.
- Keep the Item Detail page compact by showing only the most recent history entries by default.
- Preserve raw JSON access for admin verification.

## Non-Goals

- Do not change the audit log schema or write path.
- Do not alter Supabase RLS policies.
- Do not add filtering, server-side search, or export behavior to audit logs.
- Do not redesign the whole DB Panel.

## Recommended Approach

Create a shared audit display helper used by both surfaces. The helper will provide:

- Thai action labels, for example `create` to `สร้างข้อมูล`, `update` to `แก้ไขข้อมูล`, `delete` to `ลบข้อมูล`, `restore` to `กู้คืนข้อมูล`, and fallback behavior for unknown actions.
- Thai target-table labels for `items`, `profiles`, `categories`, `locations`, `units`, and `audit_logs`.
- Thai field labels for common item, profile, metadata, and audit fields.
- Thai value formatting for known item status, item type, role, boolean, null, numbers, and nested objects.
- A diff builder that compares `old_data` and `new_data`, omits unchanged fields, and ignores noisy metadata such as `updated_at` by default.

This keeps translation behavior consistent between the DB Panel and Item Detail Timeline and makes the core behavior unit-testable.

## DB Panel Behavior

The Audit Logs tab remains a dense table. The table changes only where audit readability needs improvement:

- The `action` cell shows a Thai action label with the raw action code as secondary technical text when useful.
- The `target_table` cell shows a Thai data type label with the raw table name as secondary text.
- The `old_data` and `new_data` cells stop rendering truncated JSON as the primary content.
- For rows with comparable payloads, the JSON cells show a compact summary such as `เปลี่ยนแปลง 4 ฟิลด์`.
- For rows without a meaningful diff, the cells show `ดูรายละเอียด JSON`.
- A detail button or clickable summary opens a modal.

The modal shows:

- Header: Thai action label, Thai target-table label, target ID, timestamp.
- Main diff section: changed fields only, each row showing Thai field label, old value, and new value.
- Empty-diff state: clear Thai text explaining that no changed fields were found or that the payload is raw event data.
- Raw JSON section: collapsible old/new JSON blocks for admin audit verification.

The modal should be implemented with existing local patterns, likely a fixed overlay similar to the current DB Panel form modal, to avoid introducing a new dialog dependency.

## Item Detail Timeline Behavior

The item detail page should keep data fetching on the server and move only the interactive timeline collapse behavior into a small client component.

The timeline changes:

- Use the shared helper for action labels, field labels, and value formatting.
- Show changed fields with Thai field names instead of raw database keys.
- Omit unchanged fields and `updated_at` from normal diff output.
- Show the latest 3 audit entries by default.
- If there are more than 3 entries, show a compact button to expand all entries and collapse back to the latest 3.
- Keep all audit log data admin-only as it is today.

## Component Boundaries

- Shared helper: `features/audit-log-display/` or `lib/audit-log-display.ts`, depending on existing import direction. It must not depend on React.
- DB Panel modal/render helpers: local to `app/(dashboard)/admin/db-panel/db-panel-client.tsx` unless the component becomes too large, in which case extract to a sibling client component.
- Item timeline: extract to `app/(dashboard)/items/[id]/item-audit-timeline.tsx` as a client component receiving already-fetched `ItemAuditLog[]`.

## Data Flow

No server data flow changes are required.

- DB Panel continues to fetch paginated `audit_logs` through `getTableData`.
- Item Detail continues to fetch `getItemAuditLogs(id)` on the server.
- Both surfaces pass row payloads into the shared helper for display-only transformation.

## Error Handling

- Unknown actions, target tables, or fields fall back to the raw value with a restrained technical style.
- Invalid or non-object JSON payloads render as raw values rather than throwing.
- Missing `old_data` or `new_data` is treated as create/delete/event data, not as an error.

## Testing

Add focused unit tests for the shared helper before implementation:

- Action label translation.
- Target-table label translation.
- Field label translation with fallback behavior.
- Value formatting for item status, item type, role, boolean, null, and objects.
- Diff generation returns only changed fields.
- Diff generation ignores `updated_at` by default.
- Create/delete-style rows with only one payload still produce readable display rows or raw detail fallback.

After UI integration, run:

- `npm test`
- `npm run lint`
- `npm run build`

## Acceptance Criteria

- DB Panel Audit Logs no longer forces admins to read truncated `old_data` and `new_data` JSON in the table.
- Audit-log detail modal shows changed fields as Thai key-value comparisons by default.
- Raw JSON remains available from the modal.
- Audit action and target-table labels are Thai in the DB Panel.
- Item Detail Timeline uses Thai field labels and known Thai value labels.
- Item Detail Timeline shows only 3 entries by default when more history exists, with a working expand/collapse control.
- Existing audit-log permissions and data queries remain unchanged.
