# CAMMS — Product Context

## What is CAMMS?

**Center Asset Material Management System** — internal web app for Thai government/office units to track shared assets and materials.

## Users & Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: user management, settings, DB inspection, item deletion, role assignment |
| **Staff** | Create/update items, batch ops, reference metadata. Cannot delete items or manage users |
| **Viewer** | Read-only: browse items, reports, dashboard |

## Core Capabilities

- Item/inventory CRUD with asset numbers, serial numbers, locations, categories, units
- Image upload with client-side crop/compress
- Excel (.xlsx) and PDF report export
- Depreciation tracking
- Audit logging for all mutations
- Realtime updates across registry, dashboard, reports, audit log
- QR code / asset tag label printing (A4, thermal roll)
- Physical audit check-in

## Design Constraints

```
✅ Thai-first UI with Capriola (Latin/numerics) & Sarabun (Thai typography)
✅ Light and dark mode via semantic CSS tokens
✅ Blue, violet, emerald, slate section headers; amber for depreciation
✅ Text + icons alongside color (not color-only labels)
✅ Responsive layout with clear missing-data states
✅ Add-item form is the reference UX pattern
```

## Hard Boundaries

```
❌ Do NOT change permissions logic or RBAC rules
❌ Do NOT alter depreciation calculation formulas
❌ Do NOT modify database records directly
❌ Do NOT use decorative dashboards, clipped identifiers, or color-only labels
```
