# Login Page Split-Screen Enterprise Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the CAMMS login page (`app/(auth)/login/page.tsx`) into an Official Enterprise Split-Screen Workspace with left brand/system panel, responsive layout, refined inputs, and accessibility.

**Architecture:** Update `app/(auth)/login/page.tsx` to use a responsive split-screen CSS grid layout (`lg:grid lg:grid-cols-12 min-h-screen`). The left panel showcases the CAMMS emblem, mission, feature highlights, and system status indicator. The right panel contains the accessible authentication form, password visibility toggle, localized error banners, and support information.

**Tech Stack:** Next.js 16 (App Router, Client Component with Suspense), React 19 (`useActionState`), Tailwind CSS v4, Lucide Icons (`Package`, `Lock`, `User`, `Eye`, `EyeOff`, `AlertCircle`, `CheckCircle2`, `ShieldCheck`), Node.js `node:test` (`tsx --test`).

## Global Constraints

- Strict TypeScript checking (`npm run typecheck`) must pass with 0 errors.
- ESLint flat configuration (`npm run lint`) must pass.
- All existing and new tests (`npm test`) must pass cleanly.
- Production build (`npm run build`) must succeed.
- UI labels and controls must follow Thai-first conventions.

---

### Task 1: Implement Split-Screen Layout in `app/(auth)/login/page.tsx`

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Test: `tests/component/login-page.test.tsx`

**Interfaces:**
- Consumes: `login` action from `@/features/auth/actions`, `useSearchParams` from `next/navigation`, `Button` from `@/components/ui/button`, Lucide icons
- Produces: Responsive split-screen login page

- [ ] **Step 1: Write failing component test in `tests/component/login-page.test.tsx`**

Create `tests/component/login-page.test.tsx`:
```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders split-screen enterprise layout and branding', () => {
  const element = React.createElement(LoginPage)
  const html = ReactDOMServer.renderToString(element)
  assert.ok(html.includes('CAMMS') || html.includes('Center Asset Material Management System'), 'Must render system name')
  assert.ok(html.includes('เข้าสู่ระบบ'), 'Must render login heading/button')
  assert.ok(html.includes('รหัสผู้ใช้') || html.includes('ID'), 'Must render username/id input label')
  assert.ok(html.includes('รหัสผ่าน') || html.includes('Password'), 'Must render password input label')
})
```

- [ ] **Step 2: Run test to verify failure or baseline**

Run: `npx tsx --test tests/component/login-page.test.tsx`

- [ ] **Step 3: Implement new split-screen layout in `app/(auth)/login/page.tsx`**

Update `app/(auth)/login/page.tsx` with:
- Left Column (`lg:col-span-5 xl:col-span-4 bg-slate-950 text-white p-8 sm:p-12 flex flex-col justify-between`):
  - Brand header with CAMMS badge
  - Mission statement & 3 key capability highlights
  - Live system status pill (`พร้อมใช้งานปกติ` with green dot) and security notice
- Right Column (`lg:col-span-7 xl:col-span-8 bg-slate-50/50 flex items-center justify-center p-6 sm:p-12`):
  - Centered clean login card (`max-w-[440px]`)
  - Username/ID and Password inputs with left icons and show/hide password toggle
  - Inactive account banner and error banner
  - Submit button with pending state
  - Support contact notice & copyright

- [ ] **Step 4: Run component test to verify pass**

Run: `npx tsx --test tests/component/login-page.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/(auth)/login/page.tsx tests/component/login-page.test.tsx
git commit -m "feat(auth): redesign login page into enterprise split-screen layout"
```

---

### Task 2: Component Testing & Quality Pipeline Check

**Files:**
- Test: `tests/component/login-page.test.tsx`

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: 306+ tests passing, 0 fails.

- [ ] **Step 2: Run strict TypeScript typecheck**

Run: `npm run typecheck`  
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`  
Expected: 0 errors/warnings.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Build succeeds.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore(auth): verify tests, typecheck, lint, and build pass for login redesign"
```
