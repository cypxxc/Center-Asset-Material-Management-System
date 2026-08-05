# Resizable Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to drag the mouse on the sidebar's right border to resize it dynamically between 200px and 450px, persisting the chosen width in `localStorage`.

**Architecture:** Add state management (`sidebarWidth`, `isResizing`), `localStorage` sync, mouse event listeners (`onMouseDown`, `mousemove`, `mouseup`), double-click reset handler, and a styled drag handle bar to `components/layout/sidebar.tsx`.

**Tech Stack:** React 19, Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Lucide Icons.

## Global Constraints

- Thai-first UI labels.
- Minimum sidebar width: 200px.
- Maximum sidebar width: 450px.
- Default sidebar width: 260px.
- Saved localStorage key: `camms_sidebar_width`.

---

### Task 1: Add Resizable Sidebar State, Drag Logic, and Handle to Sidebar Component

**Files:**
- Modify: `components/layout/sidebar.tsx:78-95`, `338-340`

**Interfaces:**
- Consumes: Existing `SidebarProps` (`profile`, `sidebarData`).
- Produces: Resizable `<aside>` container with width state synced to `localStorage` and a interactive drag handle border.

- [ ] **Step 1: Inspect `components/layout/sidebar.tsx` and prepare implementation edits**

Verify the current `<aside>` element structure and imports.

- [ ] **Step 2: Add width state, localStorage initialization, and mouse drag handlers**

In `Sidebar` component in `components/layout/sidebar.tsx`:
Add `sidebarWidth` state (default 260), `isResizing` state (default false).
In `useEffect`, load `camms_sidebar_width` from `localStorage` if valid number between 200 and 450.
Add `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, and `handleDoubleClick` functions.

```tsx
const DEFAULT_WIDTH = 260
const MIN_WIDTH = 200
const MAX_WIDTH = 450
const STORAGE_KEY = 'camms_sidebar_width'

const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH)
const [isResizing, setIsResizing] = useState(false)

useEffect(() => {
  const savedWidth = localStorage.getItem(STORAGE_KEY)
  if (savedWidth) {
    const parsed = parseInt(savedWidth, 10)
    if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
      setSidebarWidth(parsed)
    }
  }
}, [])

useEffect(() => {
  if (!isResizing) return

  const handleMouseMove = (e: MouseEvent) => {
    const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH)
    setSidebarWidth(newWidth)
  }

  const handleMouseUp = () => {
    setIsResizing(false)
    localStorage.setItem(STORAGE_KEY, sidebarWidth.toString())
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  return () => {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}, [isResizing, sidebarWidth])

const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault()
  setIsResizing(true)
}

const handleDoubleClick = () => {
  setSidebarWidth(DEFAULT_WIDTH)
  localStorage.setItem(STORAGE_KEY, DEFAULT_WIDTH.toString())
}
```

- [ ] **Step 3: Update `<aside>` props and render Resize Handle**

Update `<aside>` tag:
- Replace fixed `w-[260px]` with `style={{ width: `${sidebarWidth}px` }}`.
- Keep `h-full shrink-0 select-none flex-col border-r border-slate-200 bg-white md:flex`.
- Append drag handle element at the right edge of `<aside>`:

```tsx
{/* Drag Handle for Resizing */}
<div
  onMouseDown={handleMouseDown}
  onDoubleClick={handleDoubleClick}
  title="ลากเพื่อปรับขนาดแถบข้าง (ดับเบิ้ลคลิกเพื่อรีเซ็ต)"
  className={cn(
    'absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-40 transition-colors group',
    isResizing ? 'bg-blue-500/50' : 'hover:bg-blue-500/30'
  )}
>
  <div
    className={cn(
      'absolute top-1/2 right-0 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors opacity-0 group-hover:opacity-100',
      isResizing && 'opacity-100 bg-blue-500'
    )}
  />
</div>
```

- [ ] **Step 4: Run typecheck to verify strict TypeScript clean**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Run lint check**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 6: Commit changes**

```bash
git add components/layout/sidebar.tsx docs/superpowers/specs/2026-08-05-resizable-sidebar-design.md docs/superpowers/plans/2026-08-05-resizable-sidebar.md
git commit -m "feat(sidebar): make sidebar resizable by dragging mouse"
```
