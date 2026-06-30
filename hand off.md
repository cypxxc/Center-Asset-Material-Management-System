# Hand Off - Office Item Registry (`D:\registry-s`)

## Critical Context

- Real application root: `D:\registry-s`
- `D:\registry-s\prototype` is only a UX/UI reference. Do not implement the main system inside `prototype`.
- Main plan file: `plna.md` (typo filename in repo; treat it as the active plan).
- Work must proceed phase by phase. Do not add features outside the current phase.
- `AGENTS.md` says this is an unusual Next.js version. Before writing Next.js code, read relevant docs in `node_modules/next/dist/docs/`.
- Current stack: Next.js `16.2.9`, React `19.2.4`, TypeScript, Tailwind, shadcn-style UI, Supabase, Zod.
- Communication preference: Thai is preferred.

## Current Phase Status

Phase 1 Foundation: implemented.

Phase 2 Item Core CRUD: implemented and verified.

Phase 3 Settings Management: implemented and verified.

Next phase to start only after user approval: Phase 4 Auth and Permission.

## Important Existing Constraints

- This is a simple Office Item Registry, not a full inventory/warehouse/procurement system.
- Do not add stock movement, receiving, issuing, approval workflow, borrow/return, or maintenance workflow unless the plan explicitly changes.
- Use soft delete or `is_active` patterns instead of destructive deletion.
- Current server actions use the Supabase service role through `createAdminClient()` and enforce roles manually. Full RLS and permission hardening belongs to Phase 4.
- Supabase recently requires explicit grants for new public tables when using Data API directly. Because current app reads/writes server-side with service role, this has not blocked Phase 2/3, but Phase 4 must handle RLS/grants properly.

## Files And Areas Already Implemented

### Auth/Foundation

- `app/(dashboard)/layout.tsx`
  - Guards dashboard routes by calling `getCurrentProfile()`.
  - Redirects unauthenticated users to `/login`.
- `app/(auth)/login/page.tsx`
  - Client login form using `useActionState`.
  - Wrapped in `Suspense` because Next 16 requires care with `useSearchParams`.
- `features/auth/actions.ts`
  - Login/logout server actions.
- `features/auth/queries.ts`
  - `getCurrentUser()`
  - `getCurrentProfile()`
- `middleware.ts`
  - Exists and works, but Next build warns that `middleware.ts` convention is deprecated and should be migrated to `proxy.ts` later.

### Database

- `db/migrations/00001_initial_schema.sql`
  - Creates `profiles`, `categories`, `locations`, `units`, `items`, `audit_logs`.
  - Enables RLS.
  - Adds item indexes and unique partial indexes for non-deleted `asset_no` and `serial_no`.
- `db/migrations/00002_units_active_columns.sql`
  - Adds `units.is_active`.
  - Adds `units.updated_at`.
  - Adds index `idx_units_is_active`.
  - This migration must be applied to the real Supabase database before relying on Settings/Item reference filtering in a live environment.
- `db/seed.sql`
  - Contains initial seed data for units, categories, locations.

### Items - Phase 2

- `features/items/schema.ts`
  - Zod schema for item form validation.
- `features/items/schema.test.ts`
  - Node test coverage for validation.
- `features/items/types.ts`
  - Item types, list/detail models, label maps.
- `features/items/queries.ts`
  - `getItemReferences()` fetches active categories, locations, and units.
  - `getItems()` supports search, filters, pagination.
  - `getItemById()` fetches item detail.
- `features/items/actions.ts`
  - `createItem()`
  - `updateItem()`
  - `softDeleteItem()`
  - Staff/admin can create/update; admin only soft deletes.
- `features/items/components/item-form.tsx`
  - Client form using server actions.
- `features/items/components/delete-item-button.tsx`
  - Client button for soft delete.
- Routes:
  - `app/(dashboard)/items/page.tsx`
  - `app/(dashboard)/items/new/page.tsx`
  - `app/(dashboard)/items/[id]/page.tsx`
  - `app/(dashboard)/items/[id]/edit/page.tsx`

### Settings - Phase 3

- `features/settings/schema.ts`
  - Zod schemas for categories, locations, units.
  - Normalizes blank optional text to `null`.
  - Converts checkbox values to booleans.
- `features/settings/schema.test.ts`
  - Validation tests for metadata schemas.
- `features/settings/types.ts`
  - Row types for categories, locations, units.
- `features/settings/queries.ts`
  - `getSettingsData()` loads all metadata for the settings page.
- `features/settings/actions.ts`
  - Admin-only create/update for categories, locations, units.
  - Prevents deactivating metadata records that are referenced by non-deleted items.
  - Revalidates `/settings`, `/items/new`, `/items`.
- `features/settings/components/metadata-sections.tsx`
  - Server-rendered form sections for category/location/unit management.
- `app/(dashboard)/settings/page.tsx`
  - Real Settings Management page.
  - Does not include user management because that belongs to Phase 4.

### Prototype-Derived UI

- `features/inventory`
  - Renamed from `features/prototype-inventory`.
  - Still contains mock/localStorage UI derived from `prototype`.
  - Currently used by some placeholder-style dashboard/report views.
  - ESLint warnings come from here. Treat this as reference/transitional UI, not final business logic.

## Verification Already Run

Commands that passed:

```bash
npm test -- features/settings/schema.test.ts features/items/schema.test.ts
npm run lint
npm run build
```

Notes:

- Tests passed: 5 tests.
- `npm run lint` passed with warnings only.
- Warnings are mostly in `features/inventory` prototype-derived files: unused imports, missing hook dependencies, and `<img>` warnings.
- `npm run build` passed.
- Build warning remains:
  - `"middleware" file convention is deprecated. Please use "proxy" instead.`
- `http://localhost:3001/settings` returned HTTP 200 during a local check, but auth redirect means this is not a full post-login functional test.

## Known Issues / Risks

1. Apply DB migration
   - Ensure `db/migrations/00002_units_active_columns.sql` is applied to the real Supabase database.
   - Without it, `features/items/queries.ts` and `features/settings/queries.ts` may fail because they select/filter `units.is_active`.

2. Encoding / mojibake
   - Some older files contain garbled Thai text from encoding issues.
   - Newer Phase 3 files use English UI labels to avoid worsening encoding noise.
   - If polishing Thai UI, edit carefully with UTF-8 and verify rendered output.

3. Middleware deprecation
   - Next 16 build warns that `middleware.ts` should become `proxy.ts`.
   - Best handled in Phase 4 when auth/permission is tightened.

4. RLS is not complete
   - Tables have RLS enabled, but policies/grants need Phase 4 hardening.
   - Current server actions use service-role server access plus manual role checks.

5. Dirty/untracked worktree
   - Many files are untracked/modified because this repo appears mid-build.
   - Do not reset or revert user work.

## Suggested Phase 4 Plan - Auth And Permission

Goal: complete Login/Profile/Role-based access/RLS according to `plna.md`.

Recommended sequence:

1. Read current Next docs before code:
   - App Router server/client components
   - Server Actions/forms
   - Routing middleware/proxy docs
   - Redirect docs

2. Audit auth flow:
   - `features/auth/actions.ts`
   - `features/auth/queries.ts`
   - `middleware.ts`
   - `app/(dashboard)/layout.tsx`
   - Login route behavior

3. Move deprecated middleware pattern:
   - Check Next 16 docs first.
   - Migrate `middleware.ts` to `proxy.ts` only if docs confirm exact convention.
   - Verify auth redirects still work.

4. Create permission utilities:
   - Add `lib/permissions.ts` or similar if not already present.
   - Centralize role checks:
     - `admin`
     - `staff`
     - `viewer`
     - active profile only
   - Keep server action checks explicit.

5. Hide/show UI actions by role:
   - Viewer: read-only.
   - Staff: create/update items.
   - Admin: all settings, soft delete, user management.
   - Do not rely on UI hiding alone.

6. Add profile/user management if in Phase 4 scope:
   - Admin can view users/profiles.
   - Admin can change role and active status.
   - Do not build advanced onboarding unless required.

7. Add RLS policies and grants:
   - Profiles:
     - users can read own profile
     - admins can manage profiles
   - Metadata:
     - authenticated active users can read active metadata
     - admins can manage metadata
   - Items:
     - authenticated active users can read non-deleted items
     - staff/admin can insert/update
     - admin can soft delete
   - Audit logs:
     - admin read
     - service/server insert if implemented
   - Include explicit grants needed for Supabase Data API.

8. Add tests:
   - Unit-test permission helpers.
   - Build-level verification.
   - If possible, add server-action validation tests where pure logic can be isolated.

9. Verify:

```bash
npm test
npm run lint
npm run build
```

Manual checks:

- Unauthenticated user redirects to `/login`.
- Viewer can open dashboard/items/detail but cannot see or perform edit/create/delete/settings actions.
- Staff can create/edit items but cannot soft delete or manage settings.
- Admin can manage items and settings.

## Suggested Phase 5 Plan - Image Upload

Goal: attach images to items using Supabase Storage.

Recommended sequence:

1. Create storage bucket for item images.
2. Add storage policies.
3. Build image upload component for item form.
4. Validate file type: jpg/png/webp.
5. Validate file size.
6. Upload from a server action or secure signed upload flow.
7. Save `image_url` or storage path to `items.image_url`.
8. Render image on item detail.
9. Verify with build and browser check.

Avoid:

- Adding image galleries.
- Adding unrelated document storage.
- Building full asset lifecycle or approval.

## Suggested Phase 6 Plan - Reports And Export

Goal: export item reports as Excel/PDF according to current filters.

Recommended sequence:

1. Replace `features/inventory` reports placeholder with real data queries.
2. Add report query based on item filters:
   - q
   - type
   - status
   - category
   - location
3. Implement Excel export with ExcelJS.
4. Implement PDF export with jsPDF or pdfmake.
5. Log export actions to `audit_logs` if Phase 4 audit permission is ready.
6. Verify exported files open and contain readable data.

Keep reports simple:

- Item list export.
- Group by type/category/location/status only if plan requires it.
- No advanced BI dashboard unless approved.

## Suggested Phase 7 Plan - Polish, QA, Deployment

Goal: production-ready pass.

Recommended sequence:

1. Remove or fully replace prototype-derived `features/inventory` screens.
2. Fix lint warnings.
3. Resolve mojibake Thai text.
4. Add loading, empty, and error states.
5. Check responsive layout on mobile/desktop.
6. Basic accessibility check:
   - labels
   - keyboard submit
   - focus visible
   - color contrast
7. Security check:
   - no service role exposed client-side
   - RLS policies tested
   - env vars documented
8. Deployment:
   - Verify `.env.local` and production env requirements.
   - Link Vercel/Supabase if needed.
   - Run production build.
9. Write a short user guide.

## Recommended Skills For Next Agent

Use these skills when relevant:

- `vercel:nextjs` before Next.js routing/server-action changes.
- `build-web-apps:react-best-practices` after editing multiple React/TSX files.
- `supabase:supabase` for Supabase Auth, RLS, Storage, policies, migrations.
- `supabase:supabase-postgres-best-practices` for schema/policy/query work.
- `superpowers:test-driven-development` for Phase 4 permission helpers and validation logic.
- `superpowers:systematic-debugging` if auth redirects, RLS, or build behavior is confusing.
- `vercel:agent-browser-verify` or browser verification after starting a dev server and changing UI flows.

## Useful Commands

Install deps if needed:

```bash
npm install
```

Run dev server:

```bash
npm run dev -- --port 3001
```

Run tests:

```bash
npm test
```

Run focused tests:

```bash
npm test -- features/settings/schema.test.ts features/items/schema.test.ts
```

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Supabase CLI is installed:

```bash
supabase --version
```

Observed version: `2.107.0`.

## Final Reminder

Follow `plna.md` strictly. The next safe milestone is Phase 4 only, after user approval. The project should remain a small, practical office item registry: searchable, permissioned, cloud-based, and easy to maintain.
