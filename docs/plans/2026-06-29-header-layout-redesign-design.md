# Design Document: Items Registry Header Redesign

## Goal
Improve the layout of the Header Area on the Items Registry page to resolve density, redundancy, and clutter. This includes removing global search from the navbar, removing the duplicate type filter dropdown, integrating breadcrumbs with the main heading, and implementing a functional Excel Export button in the Action Bar.

## Proposed Design Details

### 1. Top Navbar Modification
* **File**: `components/layout/header.tsx`
* **Changes**:
  * Remove the `<form action="/items" ...>` search bar component from the top-right of the navbar.

### 2. Page Header Restructuring
* **File**: `app/(dashboard)/items/items-explorer-client.tsx`
* **Changes**:
  * Remove the standalone grey `OS File Explorer Path Header` bar.
  * Remove the old title block in the main area.
  * Implement a unified 2-row layout in the header of the main content area.
  * **Row 1 (Top)**:
    * **Left**:
      * Compact Breadcrumb (`root / items / [type]`) styled with a clean monospace look.
      * Dynamic Heading underneath the breadcrumb, set based on `params.type` (e.g. "รายการทะเบียนวัสดุ" for material, "รายการทะเบียนครุภัณฑ์" for asset).
    * **Right**:
      * View Mode Toggle (List/Grid view switcher).
  * **Row 2 (Bottom - Action Bar)**:
    * **Left**: Search Input, Category Select Dropdown, and Status Select Dropdown aligned inline.
    * **Right**: Export Button (green/emerald button with a Download icon).
    * *Redundant Type Select Filter is removed completely.*

### 3. Server Actions & Excel Export Implementation
* **File**: `features/items/actions.ts`
  * Create a server action `getItemsForExport(params: ItemListSearchParams)` that queries and returns all items matching the filter params using `getReportItemsList(params)` from `features/reports/queries.ts`.
* **File**: `app/(dashboard)/items/items-explorer-client.tsx`
  * Add the `exportToExcel` function to the component that fetches all matching items via `getItemsForExport` and generates a downloadable `.xlsx` file using `exceljs`.

## Spacing & Spacing Consistency
* Standardize padding of the header container using `px-6 py-5 md:px-8 border-b border-slate-200 bg-white` to align cleanly with the main container layout.
