# CAMMS Portal — Center Asset & Material Management System

A production-ready, Next.js 16 + Supabase internal web application designed for tracking office assets, supplies, materials, and equipment. Built with a Thai-first UI, strict role-based access control, dark mode support, and comprehensive audit logging.

---

## 🌟 Key Features

- **Item & Inventory Registry**: Complete CRUD management for office assets and materials with custom asset numbers, serial numbers, locations, categories, and units.
- **Image Management**: Integrated client-side image cropping and compression dialog before Supabase Storage upload.
- **Trash & Soft Delete**: Safe soft-deletion with dedicated Trash Explorer, restoration, and admin-only permanent deletion with audit logging.
- **Reports & Export System**: Full dataset query engine with downloadable **Excel (.xlsx)** and **PDF** report generators.
- **Settings & Metadata Control**: Dynamic management of categories, locations, units, and active profile roles (Admin, Staff, Viewer).
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

1. **Client/Server Split**: Pages are Server Components querying data via `features/<domain>/queries.ts`. Mutations are performed strictly via Server Actions in `features/<domain>/actions.ts`.
2. **Dual Supabase Clients**:
   - `createClient()`: Anonymous key, RLS-enforced for standard user sessions.
   - `createAdminClient()`: Service role key for admin auth management (bypasses RLS). **Never expose service role key to client-side code.**
3. **Soft Delete Lifecycle**: Items use an active/archived status lifecycle. Explorer and KPI queries filter out deleted items by default.
4. **Sidebar Cache Revalidation**: Any item/metadata mutation calls `revalidatePath('/', 'layout')` to keep sidebar category counts in sync.

---

## 🌐 Unicode & Internationalization Policy

1. **NFC Normalization**: All incoming text inputs are normalized to Canonical Composition (NFC) via `lib/unicode.ts`.
2. **Invisible Character Stripping**: Form inputs automatically strip zero-width spaces (`\u200B`) and BOM markers (`\uFEFF`).
3. **ICU Thai Collation**: Database text columns utilize `th-TH-x-icu` collation to guarantee correct Thai dictionary sorting.

---

## 📄 License & Documentation

For detailed architectural decisions, operations, and recovery guides, see:
- [AGENTS.md](file:///D:/omni-asset/AGENTS.md) — Developer & agent guidelines
- [DEPLOYMENT.md](file:///D:/omni-asset/DEPLOYMENT.md) — Deployment & migration instructions
- [PRODUCT.md](file:///D:/omni-asset/PRODUCT.md) — Functional requirements & scope
- [SECURITY.md](file:///D:/omni-asset/SECURITY.md) — Security policies & environment governance
