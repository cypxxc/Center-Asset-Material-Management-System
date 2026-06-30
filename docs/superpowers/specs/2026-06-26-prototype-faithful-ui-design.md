# Prototype-Faithful UI Design

## Goal

Make the authenticated Next.js application visually and interactionally faithful to the latest prototype source at `prototype/src/app/page.tsx` while retaining the existing Next.js routes, Supabase data model, and role permissions.

## Visual System

Adopt the prototype's Sarabun-first typography, slate-blue application background, blue primary accent, compact panel density, 8px scrollbar treatment, and divider-led information hierarchy. Replace the current generic white/gray shadcn presentation where it conflicts with these tokens.

## Application Shell

Use the prototype's OS/File Explorer view as the desktop shell: compact command header, address/breadcrumb bar, contextual directory/filter rail, primary list/grid pane, footer status bar, and optional inspector pane. On mobile, keep one primary pane visible and present the inspector through the existing item detail route. The existing authenticated layout, URL routes, and permission-based navigation remain the system boundary.

## Route Mapping

- `/dashboard`: adapt the Overview visual hierarchy to Registry-S status, category, and recent activity data. Do not add stock movement, borrowing, or procurement behavior.
- `/items`: use a dense Explorer list with contextual filters, list/grid mode, selected-item inspector on desktop, and footer record/sync status. Keep the current create, detail, edit, and delete server workflows.
- `/reports`: retain real Excel/PDF export while adopting the prototype's report header, action placement, compact analytical panels, and printable layout.
- `/settings`: use the prototype's panel language and Thai-first labels. Keep the current categories, locations, units, and profiles data model.

## Explicit Exclusions

Do not implement the prototype's borrowing, receiving, issuing, stock movement, archive, trash, permanent delete, quick quantity mutation, or full QR workflows. Their layout and interaction patterns may be reused only where they fit the approved Registry-S scope.

## Validation

Verify desktop and mobile layouts against prototype structure, test all existing route and role states, confirm no text overflow, and preserve real Supabase CRUD, export, and authorization behavior.
