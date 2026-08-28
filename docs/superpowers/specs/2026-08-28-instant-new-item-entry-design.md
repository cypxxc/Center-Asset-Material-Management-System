# Instant new-item entry

## Goal

Open the new-item form as soon as an authorised user chooses a new-item action, without an intermediate route transition through the item registry.

## Current behaviour

The dashboard action links to `/items/new`. That server route checks the profile, then redirects to `/items?new=true`. The items page must fetch its server data before the client can mount `NewItemSheet`, creating a noticeable pause.

The sidebar already targets `/items?new=true`, but still requires navigation when used outside the items page.

## Design

All new-item entry points use `/items?new=true` as the canonical URL. The existing items explorer observes `new=true`, opens `NewItemSheet`, and removes the transient query parameter without changing current list filters.

`/items/new` remains as a compatibility route for direct links and bookmarks. It continues to enforce the server-side write permission and redirects to the canonical URL. The dashboard action changes to the canonical URL, removing its extra redirect.

## Data flow and permissions

No item data, form validation, server action, or permission rule changes. The form is still rendered only on the items page, which receives reference data and `userCanWrite` from its server component. The compatibility route retains its permission check.

## Error handling

Existing form-level validation, draft recovery, close confirmation, and success refresh behaviour remain unchanged. An unauthorised direct visit to `/items/new` continues to return to `/items`.

## Verification

Run TypeScript and lint checks. Confirm all new-item buttons point to the canonical URL and that the dashboard no longer incurs the `/items/new` redirect.
