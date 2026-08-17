# Swiss Editorial Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Swiss Editorial & Warm Alabaster aesthetic for the CAMMS login page (`app/(auth)/login/page.tsx`) with pure typographic hierarchy, crisp tactile inputs, and calm official elegance.

**Architecture:** Update `app/(auth)/login/page.tsx` with a centered, balanced white card layout on warm alabaster background, precision 1px borders, subtle ambient lighting, high-contrast micro-typography, and seamless keyboard navigation.

**Tech Stack:** Next.js 16 (App Router, Client Component with Suspense), React 19 (`useActionState`), Tailwind CSS v4, Lucide Icons (`Package`, `Lock`, `User`, `Eye`, `EyeOff`, `AlertCircle`, `ShieldCheck`), Node.js `node:test` (`tsx --test`).

## Global Constraints

- Strict TypeScript checking (`npm run typecheck`) must pass with 0 errors.
- ESLint flat configuration (`npm run lint`) must pass.
- All existing and new tests (`npm test`) must pass cleanly.
- Production build (`npm run build`) must succeed.
- UI labels and controls must follow Thai-first conventions.

---

### Task 1: Implement Swiss Editorial Layout in `app/(auth)/login/page.tsx`

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Test: `tests/component/login-page.test.tsx`

**Interfaces:**
- Consumes: `login` action from `@/features/auth/actions`, `useSearchParams` from `next/navigation`, `Button` from `@/components/ui/button`, Lucide icons
- Produces: Impeccable Swiss Editorial login page

- [ ] **Step 1: Update `tests/component/login-page.test.tsx`**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders Swiss Editorial layout and CAMMS branding', () => {
  const element = React.createElement(LoginPage)
  const html = ReactDOMServer.renderToString(element)
  assert.ok(html.includes('CAMMS'), 'Must render CAMMS brand')
  assert.ok(html.includes('Center Asset Material Management System'), 'Must render system subtitle')
  assert.ok(html.includes('เข้าสู่ระบบ'), 'Must render sign in header')
  assert.ok(html.includes('รหัสผู้ใช้') || html.includes('ID'), 'Must render identifier label')
  assert.ok(html.includes('รหัสผ่าน') || html.includes('Password'), 'Must render password label')
})
```

- [ ] **Step 2: Run test to check baseline**

Run: `npx tsx --test tests/component/login-page.test.tsx`

- [ ] **Step 3: Implement Swiss Editorial layout in `app/(auth)/login/page.tsx`**

Implement:
- Clean warm alabaster canvas (`min-h-screen w-full flex flex-col items-center justify-center bg-[#F9FAFB] p-4 sm:p-6 relative selection:bg-slate-900 selection:text-white`)
- Centered card (`w-full max-w-[420px] bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-10 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.05)]`)
- Monogram emblem, typography hierarchy, tactile inputs, password visibility toggle, localized alert banners, deep midnight submit button, and quiet security footer.

- [ ] **Step 4: Run component test to verify pass**

Run: `npx tsx --test tests/component/login-page.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/(auth)/login/page.tsx tests/component/login-page.test.tsx
git commit -m "feat(auth): implement swiss editorial and warm alabaster login design"
```

---

### Task 2: Full Verification & Production Build

**Files:**
- Test: `tests/component/login-page.test.tsx`

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: 309+ tests passing, 0 fails.

- [ ] **Step 2: Run strict TypeScript typecheck**

Run: `npm run typecheck`  
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`  
Expected: 0 errors/warnings.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Build succeeds within bundle budget.

- [ ] **Step 5: Commit and push**

```bash
git push origin main
```
