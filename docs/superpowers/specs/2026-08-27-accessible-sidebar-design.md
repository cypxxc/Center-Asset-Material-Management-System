# Accessible Explorer Sidebar Design

## Goal

Simplify the CAMMS sidebar into a Thai-first, Explorer-style navigation surface that is consistent on desktop and mobile, keyboard-accessible, and focused on finding records quickly.

## Scope

- Replace the resizable, draggable desktop sidebar with a fixed 256px sidebar.
- Remove persisted width, resize gestures, menu drag-and-drop, and `sidebar_order` mutation from the navigation UI.
- Keep the existing routes, role-based access, item counts, and Supabase query data unchanged.

## Desktop Navigation

The desktop sidebar has three clearly separated areas:

1. **Main navigation:** แผงควบคุม, วัสดุสิ้นเปลือง, ครุภัณฑ์, สถานที่, รายงาน.
2. **Category and location filters:** expandable lists below their parent navigation item, with count badges. Expansion uses a real button with an accessible name and `aria-expanded`; the parent item remains a separate link.
3. **System and account:** register-new-item action for editors, Trash, Settings, administrator tools, profile summary, and sign out.

Use Thai as the visible primary label. English may appear only where it is required by an existing route or a concise parenthetical aid. Remove the `Directory Tree`, `Inventory File System`, and `Overview Console` labels.

## Mobile Navigation

Refactor the mobile drawer to render the same navigation definitions, role gates, and filter groups as desktop. It may use a drawer-specific layout, but it must not lose available routes, category filters, location filters, reports, or the editor creation action. Selecting a mobile link closes the drawer.

## Interaction and Accessibility

- Standard links navigate. Expansion controls are buttons, never clickable spans or container divs.
- Every interactive control has a visible focus indicator and an accessible name.
- Preserve the existing active route state and use more than color to indicate the current route.
- Retain adequate contrast and at least 40px vertical targets for primary mobile actions.
- Do not add decorative motion. The mobile drawer may retain its brief state transition, with reduced-motion support.

## Architecture

Extract a shared, typed navigation definition and reusable rendering helpers so desktop sidebar and mobile drawer draw from the same route, role, label, icon, and active-state logic. Keep route-specific data fetching in the dashboard layout and pass the resulting sidebar data through the existing component boundary.

## Error Handling

No navigation action persists client-only layout preferences. Existing route-level authorization remains the source of truth. Empty categories and locations render no child links without producing an error.

## Verification

- Add or update component tests for visible primary routes, role gates, expand/collapse semantics, and mobile/desktop navigation parity.
- Verify tab navigation and Enter/Space operation for filter expanders.
- Verify desktop at 1024px and mobile drawer at 375px without horizontal overflow.
- Run focused tests, `npm run typecheck`, and `npm run lint`.

## Out of Scope

- Changes to permissions, Supabase schema, routes, counts, or item queries
- Collapsed icon-only sidebar mode
- New dashboard functionality
