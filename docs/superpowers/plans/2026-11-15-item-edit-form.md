# Item edit form redesign

Goal: make the existing Thai inventory form easier to scan and fix the four reviewed defects.

Design: retain one page and all fields. Use a single neutral surface, clear section headings with small existing section colors, larger labels and controls, and a responsive footer. Put quantity, unit and price together. Keep the existing font, semantic theme tokens, permissions, audit behavior and depreciation calculation.

Approaches: a wizard would hide fields needed for reviewing an existing item; collapsible sections would hide validation. Use visible sections instead. This is an implementation choice within the requested simpler redesign.

- [x] Add failing component tests for save feedback, crop cancellation and depreciation errors; action tests for image validation and failed saves.
- [x] Fix feedback, confirmed-file submission, field errors and image cleanup after failed persistence.
- [x] Simplify layout, group price with quantity, improve mobile and theme-token styling.
- [x] Run focused tests, full tests, typecheck, lint and build; inspect the resulting UI in a safe preview.
- [x] Review diff and report verification gaps. Preserve the existing login page edits.

Review follow-up: explicit transition submission preserves values after failures. Remount standalone successful save-and-another forms so confirmed images and completed entries cannot carry over accidentally. Added red/green tests for both paths.

User refinements: remove required-fields helper copy, edit type label and badge, and the sheet header description (including its aria-describedby reference).

Validation: focused component/action coverage and a Chromium fixture preview at 1440x1000 and 390x844. No database mutations. Full npm test stops at the existing tests/unit/theme-tokens.test.ts expectation for missing dark-theme selectors in unchanged app/globals.css; full-suite success cannot be claimed. Preview uses mock actions and does not verify live persistence or authenticated access.
