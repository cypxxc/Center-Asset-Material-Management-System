# Cart panels implementation plan

**Goal:** Adjacent cart cards on desktop, stacked on mobile.
**Architecture:** Radix Dialog containing responsive cards in BorrowCatalogView.
**Tech Stack:** React, Radix Dialog, Tailwind.
**Spec:** ../specs/2026-11-16-cart-panels-design.md

- [x] Rearrange existing list and form; preserve state, validation and pending guards.
- [x] Use shared focus containment, Escape dismissal and close button.
- [x] Run targeted lint, typecheck and review the task diff; inspect browser where available.

Validation: targeted ESLint, npm run typecheck, and file-scoped git diff --check passed. Independent source review found no concrete bugs. Browser verification attempted against localhost:3000; the configured test admin credentials were rejected, so visual and interaction checks remain unverified. No request was submitted.
