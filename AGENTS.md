<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Registry-S — Center Asset & Material Management System

Next.js 16 + Supabase internal app for tracking office assets, supplies, and equipment (items, locations, units, categories, audit logs). Thai-first UI labels. Brand voice: calm, official, precise, Explorer-style information density. See `PRODUCT.md` and `README.md`.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm run start` — production build / run
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- `npm test` — `tsx --test`, runs `*.test.ts` (e.g. `features/items/schema.test.ts`)
- `npm run verify-env` — validate required Supabase env vars
- `npm run mcp` — local MCP server (`scripts/mcp-server.ts`)
- `tsx scripts/apply-migrations.ts` — apply `db/migrations/` to Supabase

There is no separate `typecheck` script; TS runs through `next build` (`tsconfig.json` has `"strict": true`).

## Stack & gotchas

- **Next.js 16, React 19** — use the docs in `node_modules/next/dist/docs/` (per the warning above). Notably the middleware file is named **`proxy.ts`** (not `middleware.ts`) and exports `proxy()`; it calls `lib/supabase/middleware.ts` `updateSession`.
- **Tailwind v4** — CSS-based config. There is **no `tailwind.config.*`**; theme tokens live in `app/globals.css` (`@theme inline` + CSS variables). PostCSS uses `@tailwindcss/postcss`.
- **shadcn** — `components.json` uses style `radix-nova`. Uses the umbrella **`radix-ui`** package (not individual `@radix-ui/*` packages) and `lucide-react` icons. Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.
- **Path alias** `@/*` → repo root (e.g. `@/lib/supabase/server`, `@/features/items/queries`). Use `@/` for all cross-module imports.
- **Zod v4** for schemas (`features/*/schema.ts`). Validated in server actions; errors mapped to `fieldErrors`.

## Architecture & layer rules

```
app/                      Next.js App Router (route groups: (auth), (dashboard))
  (dashboard)/<route>/page.tsx        server component (data via features/*/queries)
  (dashboard)/<route>/*-client.tsx    'use client' interactive shell
features/<domain>/        bounded feature: actions, queries, types, schema, components/
  actions.ts              'use server' — mutations; revalidate, redirect, permission checks
  queries.ts              'server-only' + React cache() — reads; never import from actions
  types.ts / schema.ts    shared types / zod schemas; *.test.ts co-located here
lib/
  supabase/server.ts      createClient() = anon key, RLS-respecting (default)
                          createAdminClient() = service-role, bypasses RLS (admin/auth ops only)
  supabase/middleware.ts  session refresh + auth + is_active profile gating
  permissions.ts          role helpers: isAdmin / canWrite / canDelete / canManageSettings / canManageTrash
components/layout/        header, sidebar (sidebar data is layout-scoped; revalidated via revalidatePath('/', 'layout'))
components/ui/            shared primitives (button, zoomable-image)
```

- **Client/server split**: pages are server components that fetch via `features/*/queries.ts`; interactive pieces are separate `*-client.tsx` files. Server actions live in `features/*/actions.ts` with `'use server'`.
- **Two Supabase clients**: prefer `createClient()` (anon, RLS-enforced). Use `createAdminClient()` only for Supabase Auth management and operations that must bypass RLS.
- **Roles**: `admin` > `staff` > `viewer`. Gate writes with `requireEditor()`/`requireAdmin()` in actions and the helpers in `lib/permissions.ts`. Never trust client-only auth checks.
- **Soft delete**: items use an archive/`status` lifecycle. Many explorer, KPI, and report queries **exclude archived/disposed items by default** — preserve that filter when editing queries.
- **Sidebar cache**: after any item mutation, call `revalidatePath('/', 'layout')` so counts refresh.

## Data & migrations (Supabase Postgres)

- Migrations: `db/migrations/NNNNN_snake_case.sql`, applied in order. Seed: `db/seed.sql` (writes `auth.users` directly for local dev).
- Tables: `profiles`, `items`, `locations`, `units`, `categories`, `audit_logs`. RLS policies are part of the schema (`00003_rls_policies.sql` + later fixes) — assume RLS is on for every table; confirm policies when changing access patterns.
- `audit_logs` records admin item actions (create/update/delete/restore/hard-delete).

## Environment & secrets

Required env (`.env.local` for dev; `.env*` is gitignored):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **never commit**; admin-auth operations depend on it.

CI (`.github/workflows/ci.yml`, Node 20) runs `verify-env` → `test` → `build` on push/PR to `main`, with fallback placeholder secrets.

## Excluded paths

`prototype/` and `.agent/` are gitignored / excluded from TS and ESLint — do not treat them as app source. `*.tsbuildinfo` and `next-env.d.ts` are generated; don't edit.
