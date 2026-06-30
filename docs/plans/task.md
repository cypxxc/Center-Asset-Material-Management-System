# Task Progress Tracker

| Task | Description | Status |
|---|---|---|
| Task 1 | Create Server Action `getItemsForExport` for non-paginated data export in `features/items/actions.ts` | Done |
| Task 2 | Remove global search from navbar in `components/layout/header.tsx` | Done |
| Task 3 | Restructure layout, add dynamic title/breadcrumb, remove type dropdown, and add Export button in `app/(dashboard)/items/items-explorer-client.tsx` | Done |
| Trash-1 | Add `canManageTrash` permission helper in `lib/permissions.ts` | Done |
| Trash-2 | Add `getDeletedItems` query and types in `features/items/queries.ts` | Done |
| Trash-3 | Add 4 Server Actions (restore/hardDelete) in `features/items/actions.ts` | Done |
| Trash-4 | Create `TrashExplorerClient` component with restore, hard-delete, confirmation dialog | Done |
| Trash-5 | Route `/items?deleted=true` to TrashExplorerClient in `page.tsx` | Done |
| Trash-6 | Show Trash menu to Staff in sidebar | Done |
| Perf-1 | Create database indexes migration `00009_performance_indexes.sql` and run it via admin RPC | Done |
| Perf-2 | Implement parallel data fetching (`Promise.all()`) in `app/(dashboard)/items/page.tsx` | Done |
| Perf-3 | Implement caching (`unstable_cache`) for references in `features/items/queries.ts` | Done |
| Perf-4 | Add `revalidateTag` in categories, locations, units server actions | Done |
| Perf-5 | Add optimistic state update for status updates in `items-explorer-client.tsx` | Done |

