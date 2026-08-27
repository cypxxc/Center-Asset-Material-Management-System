# Global New Item Modal Design

## Goal

Allow authorized users to open the new-item modal immediately from the dashboard sidebar on any authenticated page.

## Architecture

- Add a dashboard-level client shell that owns modal open state.
- Render the existing `NewItemSheet` once in that shell with the layout-provided reference data.
- Replace the sidebar creation link with a callback that opens the modal.
- Keep the existing items-page modal trigger compatible during transition, without duplicating a second open modal.

## Behavior

- Clicking `ขึ้นทะเบียนใหม่` opens the modal over the current page without navigation.
- On successful creation, close the modal, refresh the active route, and revalidate layout-scoped sidebar counts.
- Keep role gating server-enforced and render the trigger only for editors.

## Verification

- Test sidebar activation from a non-items dashboard page.
- Test success closes the modal and preserves route context.
- Run type checking and linting.
