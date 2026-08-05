# Image Display Resilience & Public Storage Policy Design

## Overview
Fix image display issues after uploading item images by implementing automatic client-side image URL fallback (from transformed `/render/image/` to original `/object/public/`) and updating Supabase Storage RLS policy to allow public select access on the `item-images` public bucket.

## Problem Statement
1. **Transformation Endpoint Failures**: When Supabase Image Transformation endpoint (`/storage/v1/render/image/public/...`) is disabled or unavailable (e.g. Local Dev, Free Tier), browsers get 404/400 errors rendering blank/broken images.
2. **Restricted Storage RLS**: Migration `00004_storage_setup.sql` restricts select access to `to authenticated`. Unauthenticated or public viewers receive 403 Forbidden when fetching item images.

## Design Details

### 1. Database Migration: `db/migrations/00032_public_storage_read_policy.sql`
- Add migration granting `select` on `storage.objects` for `bucket_id = 'item-images'` to `public` (both `anon` and `authenticated`).

### 2. Client-Side Image Component Fallback
- In `ZoomableImage` (`components/ui/zoomable-image.tsx`) and `ImageUploadInput` (`features/items/components/item-form.tsx`):
  - Track image source state initialized with transformed URL.
  - Implement `onError` handler:
    - First failure: Fall back to original raw public URL (`src` without `/render/image/public/` transformation).
    - Second failure: Fall back to a clean placeholder UI / icon.

## Testing Plan
- Test migration SQL structure and syntax.
- Test `ZoomableImage` fallback logic when transformed URL fails to load.
- Run full test suite (`npm test`) and typecheck (`npm run typecheck`).
