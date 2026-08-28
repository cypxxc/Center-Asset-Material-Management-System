# Instant new-item entry

## Goal

Open the new-item form as soon as an authorised user chooses a new-item action, without an intermediate route transition through the item registry.

## Current behaviour

The dashboard action links to `/items/new`. That server route checks the profile, then redirects to `/items?new=true`. The items page must fetch its server data before the client can mount `NewItemSheet`, creating a noticeable pause.

The sidebar already targets `/items?new=true`, but still requires navigation when used outside the items page. Both paths therefore make the form depend on the destination page being ready.

## Design

Create a client-side new-item dialog provider in the persistent dashboard layout. It owns an always-available `NewItemSheet` and exposes an `openNewItemSheet()` callback through React context. The layout server component loads the reference data once and passes it to this provider.

Replace the sidebar and dashboard links with client-side trigger buttons that call the context callback. They open the form without changing the active route or waiting for the items page. The items explorer retains its local sheet only for editing an existing item and no longer watches `new=true`.

`/items/new` remains as a compatibility route for direct links and bookmarks. It retains its server-side write-permission check then redirects to `/items?new=true`. The dashboard-level provider consumes that query parameter, opens the sheet, and removes the transient parameter while preserving any other item-list filters.

## Data flow and permissions

No item data, form validation, server action, or permission rule changes. The dashboard layout loads the reference data and form template options, while server-side permission checks remain in the create action and compatibility route. Client-side triggers render only for `admin` and `staff` roles.

## Error handling

Existing form-level validation, draft recovery, close confirmation, and success refresh behaviour remain unchanged. On success, the provider closes the sheet, shows the existing success toast, and refreshes the current route so an open item list receives the new record. An unauthorised direct visit to `/items/new` continues to return to `/items`.

## Verification

Run TypeScript and lint checks. Confirm Sidebar and Dashboard open the sheet without navigation, direct `/items/new` links still work, and the list continues to support item editing.
