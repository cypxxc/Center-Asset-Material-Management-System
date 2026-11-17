# Image storage investigation ? 2026-11-16

Scope: investigate missing item images; preserve all existing workspace changes and database records.
Branch: codex/fix-image-storage-path.

## Evidence and cause

Seven active item records reference local images. Only one existed in the configured project-root storage; the other six existed under .next/standalone/.local-storage. Next standalone changes process.cwd() to its own directory, so the relative LOCAL_STORAGE_PATH pointed at different directories in dev and production. Build output is not persistent upload storage.

## Recovery and change

Copied the six referenced images into project-root storage with exclusive creation, verified each copy with SHA-256, and retained every original. No database records were changed.

package.json now preloads scripts/resolve-storage-path.mjs before starting standalone. It resolves LOCAL_STORAGE_PATH to an absolute path before Next changes directory. Absolute configured paths retain their meaning. The existing ./data/storage fallback is retained when unset. Restart production through npm start to apply the startup fix; the running process was not restarted.

## Validation

- Before fix: regression reproduction failed for relative and unset storage paths; absolute path passed.
- After fix: all 16 focused startup/storage tests passed.
- npm run lint passed; npm run typecheck passed.
- Independent review found no concrete bugs in the three changed code/test files.
- All seven images were readable through the real storage function with an active admin identity and normal application database/RLS connection. This diagnostic supplied the identity in process, rather than testing browser login.
- Unauthenticated HTTP requests returned 404 for all seven images; authenticated browser flow remains unverified because configured test credentials were previously rejected. No authentication or authorization behavior was changed.
- Existing baseline component test ItemForm revokes old local image previews when replacing files fails (expected revoked blob:test-1, got empty list). The other three item-form tests passed. That baseline failure predates this startup-only fix and remains unresolved.
- No production build or full test suite was run for this startup-only change; targeted tests exercise the actual npm start arguments in isolated temporary directories.
