# Remove Settings Users Tab Design

## Goal

Keep the Settings page focused on system configuration and item reference dimensions by removing the in-page user-management tab.

## Scope

- Remove the `users` tab trigger, user-profile fetch, and users-tab content from `app/(dashboard)/settings/page.tsx`.
- Remove settings-tab links and redirects that target `tab=users`.
- Keep the separate administrator route at `/admin/users` unchanged.

## Behavior

Requests using `?tab=users` fall back to the default Settings tab. No user profile, role, permission, SSO, or admin-route behavior changes.

## Verification

- Confirm Settings displays only the remaining system and item-dimension tabs.
- Confirm `/admin/users` is unaffected.
- Run focused tests, TypeScript checking, and linting.
