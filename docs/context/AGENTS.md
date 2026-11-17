<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent Rules

### Before Any Task

1. Read `node_modules/next/dist/docs/` for current Next.js APIs
2. Read `docs/context/PRODUCT.md` → understand scope and constraints
3. Read `docs/context/README.md` → understand stack and architecture

### Code Patterns

```
✅ Server Components fetch data via features/<domain>/queries.ts
✅ Mutations use Server Actions in features/<domain>/actions.ts
✅ Use createClient() for user sessions (RLS-enforced)
✅ Use createAdminClient() only for admin auth management
✅ Call revalidatePath('/', 'layout') after any item/metadata mutation
✅ Use semantic CSS tokens (bg-card, border-border, text-primary, etc.)
```

### Hard Rules

```
❌ NEVER expose SUPABASE_SERVICE_ROLE_KEY to client-side code
❌ NEVER bypass RLS without explicit admin justification
❌ NEVER add color-only labels (always text + icon alongside color)
❌ NEVER change RBAC logic, depreciation formulas, or DB records directly
❌ Do NOT run whole-system audits for ordinary feature changes
```

### CAMMS Maintenance Workflow

For: audits, slowness investigation, security fixes, unused code removal, regression coverage →
**Read** `.agents/skills/camms-maintenance/SKILL.md` first.

Apply only the requested scope.

> Example: "Use $camms-maintenance to inspect CAMMS, find causes of slowness, fix evidenced performance and security issues, remove verified unused code, add regression tests, summarize changes. Leave on a separate branch for review."
