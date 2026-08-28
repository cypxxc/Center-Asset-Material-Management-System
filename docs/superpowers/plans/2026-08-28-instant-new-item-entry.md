# Instant New-Item Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the new-item registration dialog instantly from any dashboard page without navigating to the items registry first.

**Architecture:** A client provider in the persistent dashboard layout owns the creation-mode `NewItemSheet` and publishes an `openNewItemSheet()` callback through React context. Trigger buttons use that callback, while the items explorer retains its edit-mode sheet and the provider supports the legacy `?new=true` URL.

**Tech Stack:** Next.js 16 App Router, React 19 context, TypeScript, React Testing Library, `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-28-instant-new-item-entry-design.md`

## Global Constraints

- Keep `app/(dashboard)/layout.tsx` a server component.
- Preserve server-side write checks in `features/items/actions.ts` and `app/(dashboard)/items/new/page.tsx`.
- Preserve Thai labels, draft recovery, validation, close confirmation, and current editing behavior.
- Do not stage the unrelated `package-lock.json` change.

---

## File structure

- `features/items/components/new-item-dialog-provider.tsx`: context, URL compatibility, creation sheet, trigger.
- `app/(dashboard)/layout.tsx`: loads creation data once and mounts the provider.
- `components/layout/sidebar.tsx`: uses the shared registration trigger.
- `app/(dashboard)/dashboard/page.tsx`: uses the shared registration trigger.
- `app/(dashboard)/items/items-explorer-client.tsx`: supports edit only.
- `tests/component/new-item-dialog-provider.test.tsx`: covers context and URL behavior.

### Task 1: Add a layout-scoped creation dialog provider

**Files:**

- Create: `features/items/components/new-item-dialog-provider.tsx`
- Create: `tests/component/new-item-dialog-provider.test.tsx`

**Interfaces:**

- Consumes: `NewItemSheet`, `ReferenceOption`, `AssetNumberTemplate`, `useRouter`, `usePathname`, `useSearchParams`, `useToast`.
- Produces: `NewItemDialogProvider`, `useNewItemDialog`, `NewItemDialogTrigger`.

- [ ] **Step 1: Write the failing provider test**

```tsx
test('NewItemDialogTrigger opens the creation sheet without navigation', () => {
  render(
    <NewItemDialogProvider categories={[]} locations={[]} units={[]}>
      <NewItemDialogTrigger>ขึ้นทะเบียนใหม่</NewItemDialogTrigger>
    </NewItemDialogProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'ขึ้นทะเบียนใหม่' }))
  assert.ok(screen.getByRole('dialog'))
  assert.equal(routerPushCalls, 0)
})

test('provider removes only new=true from a compatibility URL', () => {
  mockSearchParams('type=asset&new=true')
  render(<NewItemDialogProvider categories={[]} locations={[]} units={[]}>Page</NewItemDialogProvider>)
  assert.ok(screen.getByRole('dialog'))
  assert.equal(historyReplaceCalls.at(-1), '/items?type=asset')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/component/new-item-dialog-provider.test.tsx`

Expected: FAIL because the provider module does not exist.

- [ ] **Step 3: Implement the provider and trigger API**

```tsx
'use client'

const NewItemDialogContext = createContext<(() => void) | null>(null)

export function useNewItemDialog() {
  const openNewItemSheet = useContext(NewItemDialogContext)
  if (!openNewItemSheet) throw new Error('useNewItemDialog must be used within NewItemDialogProvider')
  return openNewItemSheet
}

export function NewItemDialogTrigger({ children, className }: TriggerProps) {
  const openNewItemSheet = useNewItemDialog()
  return <button type="button" onClick={openNewItemSheet} className={className}>{children}</button>
}
```

The provider stores `isOpen`, renders `NewItemSheet` with `item={null}`, closes on cancellation, shows the current Thai success toast, and calls `router.refresh()` on success. In an effect, when `new=true` appears in search parameters, it opens the dialog then uses `window.history.replaceState` to preserve pathname and all other parameters.

- [ ] **Step 4: Run the provider test to verify it passes**

Run: `npx tsx --test tests/component/new-item-dialog-provider.test.tsx`

Expected: PASS with no router navigation and preservation of `type=asset`.

- [ ] **Step 5: Commit the provider change**

```powershell
git add -- features/items/components/new-item-dialog-provider.tsx tests/component/new-item-dialog-provider.test.tsx
git commit -m "feat: add global new item dialog"
```

### Task 2: Mount the provider in the dashboard layout

**Files:**

- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**

- Consumes: `NewItemDialogProvider`, `getItemReferences()`, `getAssetNumberTemplates(true)`.
- Produces: a provider around sidebar, header, and authenticated page content.

- [ ] **Step 1: Extend the layout data load**

```tsx
const [sidebarData, references, assetNumberTemplates] = await Promise.all([
  getSidebarData(),
  getItemReferences(),
  getAssetNumberTemplates(true),
])
```

- [ ] **Step 2: Mount the provider around dashboard chrome**

```tsx
<NewItemDialogProvider
  categories={references.categories}
  locations={references.locations}
  units={references.units}
  assetNumberTemplates={assetNumberTemplates}
>
  <Sidebar profile={profile} sidebarData={sidebarData} />
  <div className="flex flex-1 flex-col overflow-hidden">
    <Header profile={profile} />
    <main id="main-content" className="flex-1 overflow-hidden">{children}</main>
  </div>
</NewItemDialogProvider>
```

- [ ] **Step 3: Type-check the server/client boundary**

Run: `npm run typecheck`

Expected: PASS with provider props matching `ReferenceOption[]` and `AssetNumberTemplate[]`.

- [ ] **Step 4: Commit the layout integration**

```powershell
git add -- 'app/(dashboard)/layout.tsx'
git commit -m "feat: mount new item dialog in dashboard layout"
```

### Task 3: Convert entry points and retain editing

**Files:**

- Modify: `components/layout/sidebar.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`

**Interfaces:**

- Consumes: `NewItemDialogTrigger`.
- Produces: no route navigation from registration controls, while inspector editing still sets `editingItem` and opens its local sheet.

- [ ] **Step 1: Replace the Sidebar link with the trigger**

```tsx
<NewItemDialogTrigger className="mt-3 flex w-full items-center justify-center space-x-1.5 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/10 transition-all hover:bg-blue-700">
  <Plus className="w-3.5 h-3.5" />
  <span>ขึ้นทะเบียนใหม่</span>
</NewItemDialogTrigger>
```

Keep the `canWrite` condition exactly as it is.

- [ ] **Step 2: Replace the Dashboard link with the trigger**

```tsx
<NewItemDialogTrigger className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-2xs transition-all hover:bg-primary/90">
  <PlusCircle className="w-4 h-4" />
  ขึ้นทะเบียนสิ่งของใหม่
</NewItemDialogTrigger>
```

Do not add `'use client'` to this server page.

- [ ] **Step 3: Remove duplicate creation handling in the explorer**

Delete `useSearchParams()`, `newParam`, `lastNewParam`, and the `new=true` cleanup effect. Keep `isSheetOpen`, `editingItem`, and the local `NewItemSheet` for edits started by `onEdit`.

- [ ] **Step 4: Run focused behavior tests**

Run: `npx tsx --test tests/component/new-item-dialog-provider.test.tsx tests/component/new-item-sheet.test.tsx`

Expected: PASS, confirming creation is global and edit/draft flows stay intact.

- [ ] **Step 5: Commit the trigger migration**

```powershell
git add -- components/layout/sidebar.tsx 'app/(dashboard)/dashboard/page.tsx' 'app/(dashboard)/items/items-explorer-client.tsx'
git commit -m "fix: open new item form without navigation"
```

### Task 4: Verify the complete user journey

**Files:**

- Modify only if verification exposes a type, lint, or test failure.

**Interfaces:**

- Consumes: completed Tasks 1-3.
- Produces: verified creation and editing flows with no unrelated lockfile change.

- [ ] **Step 1: Run project validation**

Run: `npm run typecheck; npm run lint; npm test`

Expected: every command exits successfully.

- [ ] **Step 2: Check the real user paths**

Run: `npm run dev`

Check: from `/dashboard` and `/locations`, click “ขึ้นทะเบียนใหม่”; the dialog appears and both URL and visible page stay unchanged. Visit `/items/new`; its permission-checked redirect opens the dialog. Visit `/items?type=asset&new=true`; after the dialog opens, the URL is `/items?type=asset`. From `/items`, choose “แก้ไขข้อมูล” in the inspector; its edit dialog opens with that item.

- [ ] **Step 3: Check the final diff**

Run: `git diff --check; git status --short`

Expected: no whitespace errors and `package-lock.json` remains modified but unstaged.

- [ ] **Step 4: Commit verification fixes only if required**

```powershell
git add -- features/items/components/new-item-dialog-provider.tsx 'app/(dashboard)/layout.tsx' components/layout/sidebar.tsx 'app/(dashboard)/dashboard/page.tsx' 'app/(dashboard)/items/items-explorer-client.tsx' tests/component/new-item-dialog-provider.test.tsx
git commit -m "fix: verify global new item entry"
```
