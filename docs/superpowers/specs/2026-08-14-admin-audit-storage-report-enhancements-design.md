# System Enhancements Design Doc

**Date:** 2026-08-14  
**Topic:** Admin User Management, Audit Log Explorer, Storage Cleanup, and Report Export Polish  
**Status:** Approved  

## 1. Overview & Objectives

This design document specifies the architecture and technical requirements for four major enhancements in Registry-S:
1. **Dedicated User Management UI (`/admin/users`)**: Intuitive administrative dashboard to manage user profiles, roles (`admin`, `staff`, `viewer`), and active status without using raw database table tools.
2. **Dedicated Audit Log Explorer UI (`/admin/audit-logs`)**: Dedicated timeline viewer for system mutations with search, action filtering, actor details, and an interactive JSON diff visualizer.
3. **Storage Cleanup & Orphan Image Purge**: Automated lifecycle cleanup of Supabase Storage (`item-images` bucket) when items are hard deleted or when item images are updated/removed.
4. **Excel & PDF Report Formatting Polish**: Polished Excel output with styled headers, auto-fit column widths, number/currency formatting, and summary rows; enhanced PDF generation with Thai text bounds and page numbering.

---

## 2. Architecture & Detailed Specifications

### 2.1 Dedicated User Management UI (`/admin/users`)

- **Route:** `app/(dashboard)/admin/users/page.tsx` (Server Component) and `users-client.tsx` (Client Component)
- **Data Fetching:**
  - `getProfilesList(params: { q?: string; role?: string; is_active?: string; page?: number; pageSize?: number })` in `features/admin/queries.ts`.
  - Queries `public.profiles` using `createClient()` or admin client for admin session.
- **Server Mutations:**
  - `updateUserProfileRoleAndStatus(targetUserId: string, payload: { role?: 'admin' | 'staff' | 'viewer'; is_active?: boolean })` in `features/admin/actions.ts`.
  - Enforced via `requireAdmin()`.
  - Emits structured audit log (`USER_ROLE_CHANGE` or `USER_STATUS_CHANGE`).
  - Revalidates `/admin/users`, `/admin/db-panel`, and layout.
- **UI Components & UX:**
  - Search bar for profile name and email.
  - Role filter dropdown (All, Admin, Staff, Viewer).
  - Data table displaying Avatar/Initials, Full Name, Email, Role badge/select, Status toggle, and Created Date.
  - Confirmation dialog when demoting an admin or deactivating an active user.

### 2.2 Dedicated Audit Log Explorer UI (`/admin/audit-logs`)

- **Route:** `app/(dashboard)/admin/audit-logs/page.tsx` (Server Component) and `audit-logs-client.tsx` (Client Component)
- **Data Fetching:**
  - `getAuditLogsList(params: { q?: string; action?: string; target_table?: string; page?: number; pageSize?: number })` in `features/admin/queries.ts`.
  - Joins or maps `user_id` with `public.profiles` (full_name, email).
- **UI Components & UX:**
  - Search input matching `target_id`, `target_table`, or user identity.
  - Action type filter: `ALL`, `INSERT`, `UPDATE`, `DELETE`, `EXPORT_REPORT`.
  - Color-coded badges for action types (`INSERT` = green, `UPDATE` = blue, `DELETE` = red, `EXPORT` = amber).
  - Expandable row revealing interactive JSON diff viewer comparing `old_data` vs `new_data`.
  - Responsive pagination (50 logs/page).

### 2.3 Storage Cleanup & Orphan File Purge

- **Storage Helper:**
  - Create `lib/supabase/storage.ts`: `deleteItemStorageImage(imageUrl: string | null): Promise<{ success: boolean; error?: string }>`
  - Parses storage path from public URL (extracting relative path inside `item-images` bucket).
  - Executes `supabase.storage.from('item-images').remove([filePath])`.
- **Integration Points (`features/items/actions.ts`):**
  - In `updateItem`: If existing `item.image_url` is changed or removed, trigger `deleteItemStorageImage(oldImageUrl)`.
  - In `hardDeleteItem`: When an item is permanently removed from trash, trigger `deleteItemStorageImage(item.image_url)`.
  - Non-blocking: Storage deletion errors are logged to `lib/logging.ts` without aborting database operations.

### 2.4 Excel & PDF Report Formatting Polish

- **Excel Export Polish (`lib/reports-excel-generator.ts`):**
  - Standardize workbook generation using `exceljs`.
  - Header styling: Dark navy blue fill (`#1E293B`), white bold text, center-aligned, thin borders.
  - Number formatting: Unit price & total value formatted as `#,##0.00`; quantity formatted as `#,##0`.
  - Column auto-fit calculation: `Math.max(colHeader.length, maxDataLength) + 4`.
  - Summary row appended at the end with bold totals for quantity and valuation.
- **PDF Export Polish (`lib/reports-pdf-generator.ts`):**
  - Auto-fit table column widths preventing clipping with Thai characters.
  - Footer with localized page numbers ("หน้า X จาก Y") and generation timestamp.

---

## 3. Security, Performance & Non-Functional Requirements

- **Access Control:** All admin endpoints and queries are protected by `requireAdmin()` and verify `profile.is_active === true`.
- **Type Safety & Testing:** Strict TypeScript compliance, Zod schema validation for action payloads, unit tests for storage parser and queries, and integration tests for user and audit actions.
- **Observability:** Structured logging (`lib/logging.ts`) and audit logging for all administrative modifications.
