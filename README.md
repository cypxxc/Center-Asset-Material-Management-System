# CAMMS Portal — Center Asset & Material Management System

A production-ready, Next.js 16 + Supabase internal web application designed for tracking office assets, supplies, materials, and equipment. Built with a Thai-first UI, strict role-based access control, dark mode support, and comprehensive audit logging.

---

## 🌟 Key Features

- **Item & Inventory Registry**: Complete CRUD management for office assets and materials with custom asset numbers, serial numbers, locations, categories, and units.
- **Image Management**: Integrated client-side image cropping and compression dialog before Supabase Storage upload.
- **Permanent Item Deletion**: Authorized deletion permanently removes items with audit logging.
- **Reports & Export System**: Full dataset query engine with downloadable **Excel (.xlsx)** and **PDF** report generators.
- **Settings & Metadata Control**: Dynamic management of categories, locations, units, and active profile roles (Admin, Staff, Viewer).
- **Asset Number Templates**: Administrators can maintain reusable static asset-number templates. Staff select a template while registering an asset, review the generated preview, and edit the final number before saving; duplicate numbers are rejected.
- **Realtime Updates**: Registry, dashboard, reports, audit-log, and database-management views refresh automatically when shared data changes.
- **Dark Mode & Responsive UI**: Built with 100% semantic CSS theme tokens (`bg-card`, `border-border`, `text-primary`, etc.) for automatic light/dark mode transitions and route-level animated loading skeletons.
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full access including user role assignment, settings management, and permanent item deletion.
  - **Staff**: Operational access to create and update items and reference metadata.
  - **Viewer**: Read-only browsing across items, reports, and dashboards.
- **Unicode & i18n Hardening**: Full NFC normalization, Unicode-aware validation, UTF-8 BOM handling, and database ICU Thai collation (`th-TH-x-icu`).
- **Health & Monitoring**: Health check endpoints (`/api/health`, `/api/health/readiness`, `/api/health/liveness`, `/api/health/status`) and real-time performance bundle budget enforcement.
- **Local MCP Integration**: Built-in Model Context Protocol server for AI assistant interaction (`npm run mcp`).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2 (App Router, Turbopack, `proxy.ts` middleware)
- **UI & Styling**: React 19, Tailwind CSS v4, Radix UI (`radix-ui`), Lucide Icons
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **Validation**: Zod v4 schemas with custom Unicode preprocessors
- **Export Engines**: ExcelJS, pdfmake / custom canvas PDF generator
- **Runtime & Quality Gate**: Node.js 24.x LTS, TypeScript 5.x (Strict), ESLint 9 (Flat Config), Playwright

---

## 🚀 Quick Start

### 1. Requirements

- Node.js `>=24.0.0 <25`
- npm `11.14.1`
- Supabase Project with required environment variables

### 2. Environment Setup

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Installation & Local Development

```bash
# Install dependencies
npm install

# Run environment verification
npm run verify-env

# Start local dev server (http://localhost:3000)
npm run dev
```

---

## 📜 Development Commands

| Command | Description |
| :--- | :--- |
| `npm run check` | **Full Quality Gate**: Validates env, runs 224+ unit tests, lints code, and builds for production |
| `npm run dev` | Starts Next.js dev server with Turbopack |
| `npm run build` | Compiles production build and runs performance bundle budget checks |
| `npm run typecheck` | Strict TypeScript check with unused locals & parameters validation |
| `npm run lint` | Runs ESLint (flat config) |
| `npm test` | Runs complete test suite via Node test runner (`tsx`) |
| `npm run verify-env` | Validates required Supabase environment variables |
| `npm run verify-db-release` | Read-only verification of migrations, RLS policies, and RPC grants |
| `npm run test:smoke` | Runs Playwright browser smoke tests |
| `npm run test:e2e` | Runs Playwright E2E browser tests |
| `npm run mcp` | Starts local Model Context Protocol (MCP) server |

---

## 🗄️ Database & Migrations

Database schema and RLS policies are managed via migrations in `db/migrations/`:

```bash
# Apply specific migrations to target database
$env:MIGRATION_FILES='00001_initial_schema.sql,00002_units_active_columns.sql'
npx tsx scripts/apply-migrations.ts
```

Migration execution is tracked atomically in the `public.app_migrations` database ledger table.

---

## 🔒 Security & Architecture Rules

### Authentication and request limits

All environments use real Supabase Auth accounts. No demo accounts or fixed-password
seed scripts are bundled. Create development accounts through Supabase Auth and
provision their active `profiles` records. Authenticated browser tests require
`CAMMS_E2E_REAL_AUTH=true`, `CAMMS_E2E_ADMIN_ID`, and `CAMMS_E2E_ADMIN_PASSWORD`
configured for a staging administrator; there are no credential defaults.

The Excel import template contains headers only. Fill it with your own records
using the column format guide before importing.

Request limits use a service-role-only PostgreSQL RPC, `consume_rate_limit`, with
atomic fixed-window counters shared by every application instance. There is no
memory fallback in request authentication or rate-limit enforcement. Database or
request-context failures block protected actions. Fixed windows can permit up to
twice the limit across a window boundary; they are not sliding windows.

**Rollout order:** apply `db/migrations/20260909012737_shared_rate_limits.sql` to
the intended database, then deploy the application. The reviewed migration is
provided with this change; it is not automatically applied to remote databases.
The project migration runner can apply it after earlier migrations are present:

```powershell
$env:MIGRATION_FILES='20260909012737_shared_rate_limits.sql'
npx tsx scripts/apply-migrations.ts
```

Configure ingress trust before accepting traffic:

- On Vercel, its `VERCEL=1` runtime selects `vercel` mode and uses the platform's
  overwritten `x-forwarded-for` header. An upstream CDN's IP may be counted if it
  proxies requests into Vercel. Do not set `VERCEL=1` on a self-hosted server.
- For your own reverse proxy, set `TRUSTED_PROXY_MODE=forwarded` and
  `TRUSTED_PROXY_HOPS=1` (or the exact fixed count of trusted proxies). The app
  selects that position from the right of XFF. Every trusted hop must append or
  overwrite the verified peer address. Block direct access to the origin and
  ensure every ingress path has the same trusted hop count; otherwise do not use
  this mode. Never trust the first entry merely because a header exists.
- Without trusted ingress, default `none` mode ignores supplied IP headers.
  Anonymous logins share an `unknown` bucket, so deployments should configure
  their trusted ingress to avoid throttling unrelated users together.

Login limits are IP-based regardless of any existing session. Authenticated
mutations are user-based so changing IP does not reset their counters. Failed
limit checks return an error; do not work around them with an in-memory fallback.
Expired counters are removed in bounded batches during requests; raw identities
and IPs are not stored in the counter table (keys are SHA-256 digests).

Raw SQL remains off unless `ADMIN_SQL_ENABLED=true`. Only enable it during a
controlled maintenance window and turn it off afterward. Every execution needs
the explicit `EXECUTE SQL` confirmation, an active administrator, and a persisted
audit attempt. A failed completion audit reports that SQL may already have run;
inspect the database before retrying. Confirmation reduces accidental execution;
it does not constrain SQL privileges or replace backups and administrator access
control.

Security tests include a disposable embedded PostgreSQL runtime (PGlite) for SQL
syntax, grants, expiry, and shared-counter behavior. It serializes queries and
does not prove multi-connection locking behavior on the deployed database.

1. **Client/Server Split**: Pages are Server Components querying data via `features/<domain>/queries.ts`. Mutations are performed strictly via Server Actions in `features/<domain>/actions.ts`.
2. **Dual Supabase Clients**:
   - `createClient()`: Anonymous key, RLS-enforced for standard user sessions.
   - `createServiceRoleClient()`: Service role key for admin auth management (bypasses RLS). **Never expose service role key to client-side code.**
3. **Permanent Item Deletion**: Authorized admin and staff users permanently delete items rather than retaining them for recovery or filtered display.
4. **Sidebar Cache Revalidation**: Any item/metadata mutation calls `revalidatePath('/', 'layout')` to keep sidebar category counts in sync.

---

## 🌐 Unicode & Internationalization Policy

1. **NFC Normalization**: All incoming text inputs are normalized to Canonical Composition (NFC) via `lib/unicode.ts`.
2. **Invisible Character Stripping**: Form inputs automatically strip zero-width spaces (`\u200B`) and BOM markers (`\uFEFF`).
3. **ICU Thai Collation**: Database text columns utilize `th-TH-x-icu` collation to guarantee correct Thai dictionary sorting.

---

## 📄 License & Documentation

### Items and Reports performance rollout

Apply `db/migrations/20260909015108_bounded_report_exports.sql` before deploying
the matching application. The earlier shared rate-limit migration
`20260909012737_shared_rate_limits.sql` is also required. Record migrations in
the release ledger through your migration process and run `npm run verify-db-release`.
These migrations have not been applied to the hosted database by this change.

Reports now require the bounded RPCs: failures display errors instead of loading
the entire table into Node. Excel downloads use authenticated, rate-limited
`GET /api/reports/export`, cursor batches of 500 and a streaming XLSX writer.
PDF remains capped at 5,000 records with a visible Excel recommendation.
Exports preserve filters and ordering. Batch requests do not share a database
snapshot: avoid concurrent bulk edits for a stable export. Count discrepancies
abort the download, but equal-count edits can still change its contents.
Downloads have a 280-second deadline and stop database reads on cancellation.
The browser holds the final compressed XLSX blob; very large exports may still
need a background job/object-storage workflow beyond hosting time limits.

Items retains exact pagination, measuring `items.getItems.data` separately from
`items.getItems.count`, and signs page images in one Storage request. The two
queries can observe concurrent writes at slightly different times. Existing
trigram indexes cover all six search fields; no duplicate indexes are added.
Use `db/diagnostics/items-search-plan.sql` on representative staging data and
compare data/count timings separately. No production latency improvement is
claimed without those measurements. Realtime refreshes debounce at 750 ms,
defer while hidden, and flush once the tab becomes visible.

The Excel writer adapts ExcelJS's internal worksheet stream for backpressure.
Keep cancellation, slow-consumer, and workbook-validity tests when upgrading
ExcelJS. Local PostgreSQL tests verify pagination, sorting, grants, and RLS;
hosted database performance and deployment behavior require staging validation.

For detailed architectural decisions, operations, and recovery guides, see:
- [AGENTS.md](file:///D:/omni-asset/AGENTS.md) — Developer & agent guidelines
- [DEPLOYMENT.md](file:///D:/omni-asset/DEPLOYMENT.md) — Deployment & migration instructions
- [PRODUCT.md](file:///D:/omni-asset/PRODUCT.md) — Functional requirements & scope
- [SECURITY.md](file:///D:/omni-asset/SECURITY.md) — Security policies & environment governance
