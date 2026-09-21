<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CAMMS maintenance workflow

For requests to audit CAMMS, investigate slowness, fix security issues, clean unused code, or add regression coverage, read [camms-maintenance](.agents/skills/camms-maintenance/SKILL.md). Apply only the requested scope; an ordinary feature change does not require a whole-system audit.

Example invocation in Codex:

> Use $camms-maintenance to inspect CAMMS, find the causes of slowness, fix evidenced performance and security issues, remove verified unused code, add regression tests, and summarize the changes and validation. Leave changes on a separate branch for review.
