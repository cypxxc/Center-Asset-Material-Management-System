# Center Asset & Material Management System

A custom Next.js + Supabase admin application for internal asset and inventory management.

## What this project does

- Admin-level user creation and profile management via a database control panel
- Supabase Auth user creation and password reset without leaving the app
- Supports email-less user creation using internal placeholder auth emails
- Secure admin-only workflows with role-based access control
- `profiles`, `items`, `locations`, `units`, `categories`, and `audit_logs` management

## Key features

- `admin/db-panel` UI for database browsing, insertion, update, and delete operations
- Auth-safe `createAuthUser`, `resetAuthPassword`, and `deleteAuthUser` flows
- Audit logging for admin actions
- Production-ready build and CI pipeline
- Development protections and sensitive endpoint removal

## Requirements

- Node.js 20+
- npm 10+
- Supabase project with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Local setup

1. Copy `.env.example` to `.env.local` or create a `.env.local` file.
2. Set the required Supabase variables.
3. Install dependencies:

```bash
npm install
```

4. Run the app locally:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Development commands

- `npm run dev` — start the development server
- `npm run build` — build production output
- `npm run start` — run the production build locally
- `npm test` — run schema/tests
- `npm run verify-env` — verify required environment variables are set

## Deployment readiness

This repo includes:

- `.github/workflows/ci.yml` for build/test CI
- `scripts/verify-env.ts` to validate required env variables
- `docs/deploy-readiness.md` for deployment guidance

## Security notes

- `.gitignore` excludes `.env*`, so `.env.local` should stay local
- Never commit `SUPABASE_SERVICE_ROLE_KEY`
- Ensure production environment provides service-role key securely

## Notes for Supabase

- Confirm RLS and auth row-level security on `profiles`, `items`, `locations`, `units`, and related tables
- Apply migrations from `db/migrations/`
- Admin operations rely on the Supabase service-role key for auth management

## Where to look next

- `app/(dashboard)/admin/db-panel/db-panel-client.tsx` — admin panel UI
- `features/admin/actions.ts` — admin auth actions and profile creation logic
- `lib/supabase/server.ts` — service-role Supabase client builder

## Contact

If you need changes for deployment or additional admin workflows, update the relevant code in `features/admin/actions.ts` and `app/(dashboard)/admin/db-panel/db-panel-client.tsx`.

## Unicode & Internationalization (i18n) Policy

Registry-S has been fully hardened to support all Unicode scripts (Thai, Arabic, Chinese, Japanese, Korean, Emoji, etc.) across all layers of the application.

1. **Normalization Policy**: All user-entered text is normalized to Unicode Normalization Form C (NFC) using [lib/unicode.ts](file:///d:/registry-s/lib/unicode.ts) before storage, validation, or comparison. This prevents duplicates due to character representation differences (e.g. NFC vs NFD).
2. **Validation Policy**: All validation schemas (Zod) use Unicode-aware preprocessors to strip invisible characters (such as zero-width spaces `\u200B`) and reject empty unicode-only inputs. Visual length (grapheme clusters, e.g. for emojis) is validated instead of UTF-16 code units.
3. **Search Policy**: All search queries are normalized to NFC and lowercased before querying the database, ensuring case-insensitive and representation-agnostic matches.
4. **Import/Export Policy**: CSV and JSON imports automatically strip the UTF-8 Byte Order Mark (BOM `\uFEFF`) to prevent file parsing crashes (common in Excel exports). Column headers are normalized for search-matching, and cell values are normalized for storage.
5. **Filename Policy**: Uploaded files have their filenames sanitized, replacing unsafe path symbols while fully preserving Unicode characters (Thai, Arabic, Emojis) in extensions and names.
6. **Collation & Sorting Policy**: Database text columns utilize a custom ICU-based Thai collation (`th-TH-x-icu`) to guarantee that categories, locations, and units sort in lexicographical Thai dictionary order.

