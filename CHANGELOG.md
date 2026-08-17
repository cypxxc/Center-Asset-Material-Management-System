# Changelog

All notable changes to this project will be documented here.

---

## [1.0.0] - 2026-08-17

### Added

- Enterprise-grade Design System (Tailwind CSS v4 + shadcn radix-nova)
- Asset & Material Management (Items Core CRUD, Explorer, Soft Delete & Trash lifecycle)
- Asset Tag & Label Generator (A4 3×8 and 2×7 sheets, Thermal presets, Copy multiplier, Field toggles)
- Public Read-Only QR Code Asset View for mobile phone scanning
- Dedicated User Management UI and role update workflows (`/admin/users`)
- Dedicated Audit Log Explorer with interactive JSON diff inspector (`/admin/audit-logs`)
- Automated Supabase Storage orphan image cleanup on item mutations
- Polished Excel (.xlsx) and PDF Report export with auto-fit styling and formatted currency totals
- Settings Management (Categories, Locations, Units)
- Authentication and Role-Based Access Control (Admin, Staff, Viewer)
- CSV Import and Bulk Actions
- Structured Logging, Metrics, and Health Endpoints (`/api/health`)
- Security Headers (CSP, HSTS, XSS protection), Rate Limiting, and Feature Flags
- Full WCAG AA accessibility compliance
- Playwright E2E and 305 automated unit/component tests
- Production Runbooks, SRE Guides, and Recovery documentation

### Security

- CSP
- HSTS
- XSS Protection
- CSV Injection Protection
- Request Tracing
- Typed Error Handling

### Performance

- Dynamic Excel loading
- Optimized cache
- Retry policies
- Bundle budget
- Sidebar cache revalidation support for out-of-band item mutations
