# Minimal SSO Navbar Design

## Goal

Reduce the CAMMS desktop navbar to page context only. Since authentication is handled by SSO JWT, the navbar does not need account-entry or redundant navigation controls.

## Interface

- Desktop shows the current breadcrumb and, on the item explorer, compact type and status filter indicators.
- Remove the desktop dashboard shortcut, profile settings link, user avatar/profile link, help button, and search-query tag.
- Mobile keeps only the button that opens the navigation drawer.
- Remove Trash from the mobile drawer to match the permanent-deletion workflow.

## Scope and Behavior

- Do not change routes, SSO authentication, page access, or profile data.
- Existing profile and guide routes remain reachable by direct URL; they are no longer navbar destinations.
- Preserve responsive behavior and breadcrumb route labels.

## Verification

- Update navbar tests for the retained breadcrumb/filter context and removed controls.
- Verify desktop and mobile navigation at their respective breakpoints.
- Run type checking and linting.
