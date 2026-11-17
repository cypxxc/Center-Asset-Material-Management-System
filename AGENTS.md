<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AI Agent Developer Guide — CAMMS

Welcome, AI Agent. This document is your primary entry point for understanding and modifying the **Center Asset & Material Management System (CAMMS)**.

Follow the progressive disclosure model: read this file for navigation and architecture rules, and refer to detailed documentation in [docs/](file:///D:/Center-Asset-Material-Management-System-main/docs/) when working on specific subsystems.

---

## 1. What This System Does

CAMMS is an enterprise internal management system for Thai government agencies to manage two distinct inventory classes:
1. **ครุภัณฑ์ (Durable Assets):** High-value, durable equipment tracked individually with asset numbers, serials, locations, custodians, and straight-line depreciation to 1 Baht.
2. **วัสดุ (Consumable Materials):** Supplies tracked by quantity, official government ledger balances (opening, received, issued, remaining), minimum thresholds, and stock movements.

---

## 2. Codebase Organization

```
Center-Asset-Material-Management-System/
├── app/                  # Next.js 16 App Router (Routes, Layouts, APIs)
│   ├── (auth)/login/     # Login interface
│   ├── (dashboard)/      # Protected dashboard workspaces
│   │   ├── admin/        # User accounts & audit log inspection
│   │   ├── disbursements/# Requisitions, material issues, asset loans
│   │   ├── items/        # Durable assets registry & inspector
│   │   ├── materials/    # Consumable materials registry & ledger
│   │   ├── reports/      # Official inventory & depreciation reports
│   │   └── settings/     # Categories, locations, units, CSV import
│   └── api/              # Route Handlers (/api/health, /api/events, /api/files)
├── db/postgres/          # Drizzle ORM schema and migrations (0000-0013)
├── docs/                 # Authoritative project knowledge base
├── features/             # Domain-driven feature logic, queries, and Server Actions
├── lib/                  # Shared libraries, security headers, logging, barcode/QR
├── proxy.ts              # Next.js 16 network middleware & request interceptor
└── tests/                # Comprehensive test suites (unit, component, integration)
```

---

## 3. Progressive Disclosure: Subsystem Map & What to Read Before Modifying

| If you are working on... | Read these documents first | Primary source files |
| :--- | :--- | :--- |
| **System Overview & Tech Stack** | [docs/PROJECT_CONTEXT.md](file:///D:/Center-Asset-Material-Management-System-main/docs/PROJECT_CONTEXT.md) | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json), [lib/config.ts](file:///D:/Center-Asset-Material-Management-System-main/lib/config.ts) |
| **Architecture & Network Flow** | [docs/ARCHITECTURE.md](file:///D:/Center-Asset-Material-Management-System-main/docs/ARCHITECTURE.md) | [proxy.ts](file:///D:/Center-Asset-Material-Management-System-main/proxy.ts), [lib/postgres/middleware.ts](file:///D:/Center-Asset-Material-Management-System-main/lib/postgres/middleware.ts) |
| **Database, Schema & Migrations** | [docs/DATABASE_SCHEMA.md](file:///D:/Center-Asset-Material-Management-System-main/docs/DATABASE_SCHEMA.md) | [db/postgres/schema.ts](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/schema.ts), [db/postgres/migrations/](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/migrations/) |
| **Business Logic, Stock & Rules** | [docs/BUSINESS_RULES.md](file:///D:/Center-Asset-Material-Management-System-main/docs/BUSINESS_RULES.md) | [features/disbursements/](file:///D:/Center-Asset-Material-Management-System-main/features/disbursements/), [features/items/](file:///D:/Center-Asset-Material-Management-System-main/features/items/) |
| **API Endpoints & Server Actions** | [docs/API_REFERENCE.md](file:///D:/Center-Asset-Material-Management-System-main/docs/API_REFERENCE.md) | [app/api/](file:///D:/Center-Asset-Material-Management-System-main/app/api/), [features/*/postgres-actions.ts](file:///D:/Center-Asset-Material-Management-System-main/features/) |
| **Coding, Testing & Verification** | [docs/DEVELOPMENT_GUIDELINES.md](file:///D:/Center-Asset-Material-Management-System-main/docs/DEVELOPMENT_GUIDELINES.md) | [scripts/run-tests.ts](file:///D:/Center-Asset-Material-Management-System-main/scripts/run-tests.ts), [tests/setup/dom.ts](file:///D:/Center-Asset-Material-Management-System-main/tests/setup/dom.ts) |
| **Known Issues & Technical Debt** | [docs/KNOWN_ISSUES.md](file:///D:/Center-Asset-Material-Management-System-main/docs/KNOWN_ISSUES.md) | [features/admin/postgres-policy.ts](file:///D:/Center-Asset-Material-Management-System-main/features/admin/postgres-policy.ts) |

---

## 4. Architectural Invariants (Must ALWAYS Be Preserved)

1. **Physical Separation of Materials and Assets:**
   - Durable assets live exclusively in `public.items` (`item_type = 'asset'`).
   - Materials live exclusively in `public.materials` (`item_type = 'material'`).
   - The view `public.inventory_items` is a read-only `UNION ALL` view (`WITH (security_invoker=true)`). **Never write or lock the view directly.**
2. **Restricted PostgreSQL Roles:**
   - Web application connects via `camms_app` (`DATABASE_URL`).
   - Authentication connects via `camms_auth` (`DATABASE_AUTH_URL`).
   - The app role CANNOT read password hashes in `private_auth.credentials`.
3. **Immediate Stock Deduction (Rule 0009):**
   - Material stock is deducted immediately when a requisition is submitted (`draft` -> `pending_approval`).
   - Stock is **NOT** deducted again when the document is confirmed.
   - Stock is refunded if and only if the pending request is cancelled or rejected.
4. **Depreciation Rules:**
   - Straight-line method only.
   - Residual value is strictly 1.00 THB (`depreciation_residual_value = 1.00`).
   - Materials cannot depreciate (`CHECK (NOT depreciation_enabled)`).
5. **Anti-Lockout Protection:**
   - Deactivating, demoting, or deleting an administrator requires acquiring the advisory lock `pg_advisory_xact_lock(hashtext('camms_admin_protection'))` and verifying $\text{active admins} > 1$.
6. **Thai Language & Unicode:**
   - All input strings must pass through Unicode NFC normalization.
   - Thai queries sorting by name must use `COLLATE "th-TH-x-icu"`.

---

## 5. Verification Checklist (Before Completing Any Task)

Before reporting work complete, execute and confirm:

```bash
# 1. Lint verification (0 errors required)
npm run lint

# 2. Type check verification (0 errors required)
npm run typecheck

# 3. Test suite verification (all 232 test files must pass)
npm test
```
