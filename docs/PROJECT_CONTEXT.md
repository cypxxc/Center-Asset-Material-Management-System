# CAMMS Project Context

> **Project Name:** Center Asset & Material Management System (CAMMS)  
> **Thai Name:** ระบบบริหารจัดการทรัพย์สินและวัสดุส่วนกลาง (CAMMS Portal)  
> **Target Audience:** Thai government units, universities, and public sector organizations managing inventory under Thai procurement regulations.  
> **Verification Status:** Fully verified against codebase as of November 2026.

---

## 1. System Purpose & Real-World Domain

CAMMS is an enterprise-grade internal web portal specifically engineered to manage, track, disburse, and audit durable assets (**ครุภัณฑ์**) and consumable materials (**วัสดุ**) for Thai public organizations.

### Thai Government Procurement Context
Under the regulations of the Ministry of Finance, the Comptroller General's Department (กรมบัญชีกลาง), and the Budget Bureau (สำนักงบประมาณ), public inventory is strictly categorized into two separate accounting classifications:
1. **วัสดุ (Materials / Consumables):** Goods that are consumed, transformed, or have a short lifespan, tracked by quantity, inventory ledger, minimum/maximum thresholds, and balance sheets.
2. **ครุภัณฑ์ (Assets / Durable Equipment):** Long-lasting durable items, individually tracked by Asset Number (รหัสครุภัณฑ์), GFMIS number, serial number, room/building location, responsible person, and straight-line depreciation down to 1 Baht residual value.

CAMMS enforces this physical and logical separation across database storage, business validation, user interfaces, and reporting engines.

---

## 2. Core Technology Stack

| Layer | Component | Version / Details | Source Verification |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `>=24.0.0 <25` (Enforced via `package.json` engines) | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json) |
| **Package Manager** | npm | `11.14.1` | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json) |
| **Web Framework** | Next.js (App Router) | `16.4.6` (Uses `proxy.ts`, Server Actions, Webpack build) | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json), [proxy.ts](file:///D:/Center-Asset-Material-Management-System-main/proxy.ts) |
| **UI Library** | React | `19.2.8` | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json) |
| **Styling & Theme** | Tailwind CSS | `v4.3.3` (`@tailwindcss/postcss`, CSS theme tokens) | [app/globals.css](file:///D:/Center-Asset-Material-Management-System-main/app/globals.css) |
| **Icons & UI Primitives** | Lucide React, Radix UI | `lucide-react@^1.25.0`, `radix-ui@^1.6.4` | [package.json](file:///D:/Center-Asset-Material-Management-System-main/package.json) |
| **Typography** | Sarabun & Capriola | Thai: *Sarabun*, Latin & Numbers: *Capriola* | [app/layout.tsx](file:///D:/Center-Asset-Material-Management-System-main/app/layout.tsx) |
| **Database & ORM** | PostgreSQL & Drizzle ORM | PostgreSQL 16+, `drizzle-orm@0.45.2`, `pg@8.23.0` | [db/postgres/schema.ts](file:///D:/Center-Asset-Material-Management-System-main/db/postgres/schema.ts) |
| **Authentication** | Custom PostgreSQL Auth | `private_auth` schema (Bcrypt passwords, SHA-256 session tokens) | [lib/postgres/session.ts](file:///D:/Center-Asset-Material-Management-System-main/lib/postgres/session.ts) |
| **Validation** | Zod | `zod@^4.6.7` (Zod v4 API) | [features/items/schema.ts](file:///D:/Center-Asset-Material-Management-System-main/features/items/schema.ts) |
| **Reporting & Export** | ExcelJS & Native Print PDF | `exceljs@^4.4.0` (.xlsx spreadsheet generation) | [features/reports/excel-export.ts](file:///D:/Center-Asset-Material-Management-System-main/features/reports/excel-export.ts) |
| **Testing** | Node Test Runner, Playwright | `node:test`, `tsx@^4.23.1`, `@playwright/test@^1.61.1` | [scripts/run-tests.ts](file:///D:/Center-Asset-Material-Management-System-main/scripts/run-tests.ts) |

---

## 3. High-Level Subsystems & Modules

The application is structured into domain-driven feature modules under `features/`:

```
features/
├── admin/            # User administration, table management, database backup/restore
├── audit-log-display/# Audit log formatting, Thai translation, change diffing
├── auth/             # Login queries, server authentication guards, session extraction
├── depreciation/     # Asset depreciation reports and straight-line calculations
├── disbursements/    # Requisitions, material issues, asset loans, handovers, returns
├── items/            # Durable assets registry, inspector, batch operations, pagination
├── materials/        # Consumable materials registry, ledger balance, stock movements
├── reports/          # Thai government inventory reports, exports (.xlsx)
└── settings/         # Metadata management (categories, units, locations, CSV import)
```

---

## 4. Key Terminology & Domain Nomenclature

| Thai Term | English Term | Definition & Behavior in CAMMS |
| :--- | :--- | :--- |
| **ครุภัณฑ์ (Asset)** | Durable Asset | Stored in `public.items`. Individually identified durable goods with Asset No., serial no., depreciation, and location. |
| **วัสดุ (Material)** | Consumable Material | Stored in `public.materials`. Consumable goods tracked by physical quantity, fiscal year, ledger balance, and stock movements. |
| **ตามเกณฑ์ (Qualified)** | Standard Capitalized Asset | Asset meeting procurement threshold criteria (usually >= 10,000 THB or durable standard). Depreciation tracked. |
| **ต่ำกว่าเกณฑ์ (Below Threshold)** | Low-Value Durable Goods | Durable goods under capitalization threshold (often < 10,000 THB). Controlled in register without full capital depreciation. |
| **พัสดุส่วนกลาง (Central Items)** | Central Pool Items | Items available for central department requisition and issuing (`is_central = true`). All materials are central by default. |
| **การเบิกจ่าย (Disbursement)** | Disbursement / Requisition | Formal request to issue goods. Types: `material_issue`, `asset_handover`, `asset_borrow`. |
| **การตัดสต็อกทันที (Immediate Stock)** | Immediate Stock Deduction | Rule 0009: Material stock is deducted immediately upon request submission, restored on cancellation/rejection. |
| **บัญชีคุมวัสดุ (Material Ledger)** | Government Material Ledger | Formal register recording opening balance, receipts, issues, and remaining balance. |

---

## 5. Architectural Invariants (Must Never Be Broken)

1. **Materials and Assets are Physically Distinct Tables:**
   - Durable assets live in `public.items` (check: `item_type = 'asset'`).
   - Materials live in `public.materials` (check: `item_type = 'material'`).
   - The view `public.inventory_items` is a read-only `UNION ALL` view (`WITH (security_invoker=true)`) for shared search and reporting. Never execute `INSERT`, `UPDATE`, or `DELETE` against the view.
2. **Restricted PostgreSQL Roles:**
   - Web application connects via `camms_app` (`DATABASE_URL`).
   - Authentication connects via `camms_auth` (`DATABASE_AUTH_URL`).
   - Schema migrations connect via superuser/owner (`DATABASE_MIGRATION_URL`).
   - Web role `camms_app` CANNOT access `private_auth.credentials`.
3. **Thai Government Collation and Unicode:**
   - Thai string search and sorting MUST use ICU collation (`th-TH-x-icu`).
   - All input text MUST pass through Unicode NFC normalization (`normalizeForStorage` / `normalizeForSearch`) to strip invisible characters.
4. **No Supabase Dependency in Runtime:**
   - Although early drafts used Supabase, CAMMS is 100% self-hosted PostgreSQL. No `@supabase/supabase-js` runtime dependency exists.
