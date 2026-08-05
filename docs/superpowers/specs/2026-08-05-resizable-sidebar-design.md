# Design Spec: Resizable Sidebar

**Date:** 2026-08-05  
**Feature:** Resizable Sidebar (Mouse Drag)  
**Target File:** `components/layout/sidebar.tsx`

---

## 1. Overview
Allow users to dynamically adjust the width of the main layout sidebar in CAMMS by dragging its right border with the mouse. The customized width persists across page navigations and browser sessions via `localStorage`.

---

## 2. Requirements & Behavior

### Boundaries & Defaults
- **Default Width:** `260px`
- **Minimum Width:** `200px` (ensures labels and icons remain legible)
- **Maximum Width:** `450px` (prevents sidebar from overwhelming the dashboard layout)

### User Interaction
1. **Dragging (Resize Handle):**
   - A drag handle area of `6px` width on the right edge of `<aside>`.
   - Cursor changes to `col-resize`.
   - Hover state highlights handle border in blue (`bg-blue-500/40`).
   - Dragging (`mousedown` -> `mousemove` -> `mouseup`) dynamically updates sidebar width.
   - Global class or style applied to `document.body` during drag to prevent text selection (`select-none`) and maintain `col-resize` cursor.
2. **Double-Click Reset:**
   - Double-clicking the handle resets sidebar width to the default `260px` and updates `localStorage`.
3. **Persistence:**
   - Saved key in `localStorage`: `camms_sidebar_width`.
   - Restored on client mount inside `useEffect`.

---

## 3. Implementation Details

- **File to Edit:** `components/layout/sidebar.tsx`
- **State Management:**
  - `sidebarWidth` (number, default `260`)
  - `isResizing` (boolean, default `false`)
- **Event Listeners:**
  - Attached to `window` during drag (`mousemove`, `mouseup`) to ensure drag state isn't lost if the pointer leaves the handle element quickly.
