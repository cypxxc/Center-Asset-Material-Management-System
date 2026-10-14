# CAMMS Portal — Center Asset & Material Management System

Next.js 16 internal web app for tracking office assets and materials.  
Supports **Supabase** or **standalone Docker PostgreSQL** with Drizzle ORM.  
Thai-first UI, RBAC, dark mode, audit logging.

> For Docker-only setup (no Supabase): see [docs/postgres/README.md](../postgres/README.md)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.3.4 (App Router, webpack, `proxy.ts` middleware) |
| **UI** | React 19, Tailwind CSS v4, Radix UI, Lucide Icons |
| **Database** | Supabase PostgreSQL / Standalone PostgreSQL + Drizzle ORM, RLS |
| **Auth** | Supabase Auth or local Postgres auth (`private_auth` schema) |
| **Validation** | Zod v4 + custom Unicode preprocessors |
| **Export** | ExcelJS (xlsx), browser print-to-PDF |
| **Runtime** | Node.js 24.x LTS, TypeScript 5.x strict, ESLint 9 flat config, Playwright |

---

## Project Structure

```
features/<domain>/
  queries.ts    ← Server Components fetch data here
  actions.ts    ← Server Actions (mutations) only
lib/
  unicode.ts    ← NFC normalization, invisible char stripping
db/
  migrations/   ← SQL migration files (tracked in public.app_migrations)
scripts/
  apply-migrations.ts
```

---

## Requirements

- Node.js `>=24.0.0 <25`
- npm `11.14.1`
- Supabase project **or** Docker PostgreSQL

---

## Environment Setup

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## Quick Start

```bash
npm install
npm run verify-env   # validate env vars
npm run dev          # http://localhost:3000
```

---

## Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run check` | Full quality gate: env + tests + lint + production build |
| `npm run dev` | Dev server (webpack) |
| `npm run build` | Production build + bundle budget check |
| `npm run typecheck` | Route types + strict TS + unused-code check |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Full test suite (Node test runner via tsx) |
| `npm run verify-env` | Validate Supabase env vars |
| `npm run verify-db-release` | Read-only: migrations, RLS policies, RPC grants |
| `npm run test:smoke` | Playwright smoke tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run mcp` | Start local MCP server |

---

## Database & Migrations

```bash
# Apply specific migrations
$env:MIGRATION_FILES='00001_initial_schema.sql,00002_units_active_columns.sql'
npx tsx scripts/apply-migrations.ts
```

- Migration state tracked in `public.app_migrations` ledger table

---

## Architecture Rules

### Client/Server Split
- **Pages**: Server Components → query via `features/<domain>/queries.ts`
- **Mutations**: Server Actions only → `features/<domain>/actions.ts`

### Supabase Clients
- `createClient()` — anon key, RLS-enforced (standard user sessions)
- `createAdminClient()` — service role key, bypasses RLS (admin auth management only)
- **Never expose service role key to client-side code**

### Cache Invalidation
- All item/metadata mutations must call `revalidatePath('/', 'layout')` to sync sidebar counts

### Admin Protections
- Admins cannot demote/deactivate/delete themselves
- Mutations verify ≥1 active admin remains in system

### RBAC
- **Admin**: full access including deletion, user management
- **Staff**: create/update items; no deletion, no admin ops
- **Viewer**: read-only
- `/admin/**` routes protected by folder-level layout guard

---

## Unicode & i18n Policy

- **NFC normalization**: all text inputs via `lib/unicode.ts`
- **Invisible char stripping**: zero-width spaces (`\u200B`) and BOM (`\uFEFF`)
- **ICU Thai collation**: `th-TH-x-icu` on text columns for correct Thai sorting

---

## Health Endpoints

- `GET /api/health/readiness`
- `GET /api/health/liveness`
- `GET /api/health/status`
