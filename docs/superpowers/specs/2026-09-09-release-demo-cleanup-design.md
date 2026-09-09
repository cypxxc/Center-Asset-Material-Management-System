# Release readiness and demo cleanup

## Approved scope

Inspect and remove demo behavior in repository files and the application UI. Do not query, change, or delete data in a remote database. Preserve working product features and meaningful automated tests. The user approved this scope after excluding database cleanup.

## Approach

Use targeted removal rather than deleting every occurrence of sample, mock, or preview. Broad text-based deletion would remove test fixtures and genuine print previews. Reimplementing unused demonstration tools as new production APIs would expand the requested scope unnecessarily.

## Changes to implement

1. Remove `db/seed.sql`, which creates demonstration accounts with fixed passwords and sample metadata. This removes a repository file only; do not execute SQL.
2. Remove unused `lib/tool-pipeline/tools/items.ts` and its tests of fabricated results. Preserve the tool pipeline, its authorization/validation tests, and the separate real MCP server. Confirm there are no production callers before removal.
3. Generate the import Excel template with column headers and formatting but no example inventory rows. Remove the example-data column from the CSV guide while retaining column names and accepted formats. Keep compatibility with old templates by continuing to ignore explicitly marked example rows on import.
4. Remove built-in demo credential fallbacks from authenticated E2E. Require explicit test credentials when real-auth tests are enabled. Keep intentional invalid-login fixtures for smoke testing, using clearly fictitious credentials rather than historical demo account credentials.
5. Replace image-crop success with an explicit error when image encoding is unavailable or both encoders fail. Never call the confirmation callback with an empty fabricated image. Keep the working WebP-to-JPEG fallback and adapt tests to provide real encoding mocks.
6. Update current setup instructions where they imply bundled demo accounts exist. Preserve historical migration files, security regression fixtures, format guidance, input hints, and genuine live previews.

## Verification

Run relevant regression tests for import/export templates, crop encoding failures, and release E2E prerequisites. Run the complete test suite, typecheck, lint, dependency audit, production build, and browser smoke checks. Use isolated test configuration; do not run authenticated tests that mutate a remote database in this scope.

Review the final diff and search for remaining demo behavior, classifying legitimate test-only fixtures separately. Report release readiness only to the extent verified. An authenticated staging journey remains a release gate until it passes with explicitly configured staging credentials; local checks cannot establish that result.

## Completion criteria

No shipped demonstration handlers report fabricated inventory or fake successful writes. No bundled seed file creates fixed-password accounts. Downloaded import templates contain no demo inventory. Cropping errors cannot report successful empty images. Required checks pass or each failure is documented as a concrete blocker. No remote database data is accessed or changed.

## Review status

Scope and approach are approved in conversation. This written specification awaits the user's review required by the invoked brainstorming skill before implementation planning.
