# Curved Split-Screen Dark Editorial Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Curved Split-Screen Dark Editorial layout for the CAMMS login page (`app/(auth)/login/page.tsx`) with an organic curved wave divider, subtle cyan-blue dashed trace, dark elevated input fields, sky-blue pill button, and moody landscape backdrop.

**Architecture:** Update `app/(auth)/login/page.tsx` with a desktop split grid (`lg:grid lg:grid-cols-12 min-h-screen`), where the left panel is solid dark charcoal (`#1E222D`), connected to the right atmospheric panel via an inline SVG organic S-curve path with dashed accent stroke, plus full responsive mobile fallback.

**Tech Stack:** Next.js 16 (App Router, Client Component with Suspense), React 19 (`useActionState`), Tailwind CSS v4, Lucide Icons (`Package`, `Lock`, `User`, `Eye`, `EyeOff`, `AlertCircle`, `Loader2`, `ShieldCheck`), Node.js `node:test` (`tsx --test`).

## Global Constraints

- Strict TypeScript checking (`npm run typecheck`) must pass with 0 errors.
- ESLint flat configuration (`npm run lint`) must pass.
- All existing and new tests (`npm test`) must pass cleanly.
- Production build (`npm run build`) must succeed.
- UI labels and controls must follow Thai-first conventions.

---

### Task 1: Implement Curved Split-Screen Layout in `app/(auth)/login/page.tsx`

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Test: `tests/component/login-page.test.tsx`

**Interfaces:**
- Consumes: `login` action from `@/features/auth/actions`, `useSearchParams` from `next/navigation`, `Button` from `@/components/ui/button`, Lucide icons
- Produces: Curved Split-Screen Dark Editorial login page

- [ ] **Step 1: Update component test in `tests/component/login-page.test.tsx`**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders Curved Split-Screen Dark Editorial layout and CAMMS branding', () => {
  render(React.createElement(LoginPage))

  assert.ok(screen.getByText('CAMMS'), 'Must render system acronym')
  assert.ok(
    screen.getByText(/Center Asset Material Management System/),
    'Must render full system title'
  )
  assert.ok(screen.getByRole('heading', { name: /เข้าสู่ระบบ/ }), 'Must render heading')
  assert.ok(screen.getByLabelText(/รหัสผู้ใช้/), 'Must render identifier field')
  assert.ok(screen.getByLabelText(/^รหัสผ่าน/), 'Must render password field')
  assert.ok(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }), 'Must render submit button')
})

test('LoginPage toggles password visibility when toggle button is clicked', () => {
  render(React.createElement(LoginPage))

  const passwordInput = screen.getByLabelText(/^รหัสผ่าน/) as HTMLInputElement
  assert.strictEqual(passwordInput.type, 'password')

  const toggleBtn = screen.getByRole('button', { name: 'แสดงรหัสผ่าน' })
  fireEvent.click(toggleBtn)
  assert.strictEqual(passwordInput.type, 'text')

  const hideBtn = screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' })
  fireEvent.click(hideBtn)
  assert.strictEqual(passwordInput.type, 'password')
})
```

- [ ] **Step 2: Run test to check baseline**

Run: `npx tsx --test tests/component/login-page.test.tsx`

- [ ] **Step 3: Implement Curved Split-Screen Dark layout in `app/(auth)/login/page.tsx`**

Implement:
- Left Column (`lg:col-span-6 xl:col-span-5 bg-[#1E222D] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative z-20 shadow-2xl`)
- Organic SVG Wave Divider: Smooth S-curve transition on desktop edge with semi-transparent dashed blue trace (`stroke="rgba(56, 189, 248, 0.4)" stroke-dasharray="5 7"`).
- Right Column (`lg:col-span-6 xl:col-span-7 relative hidden lg:block overflow-hidden bg-[#131720]`): Moody atmospheric landscape with dark gradients and subtle watermark (`CAMMS • v1.0.0`).
- Refined form inputs with dark background (`bg-[#2A2E3B] border-slate-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20`), right icons, and pill-shaped bright sky-blue login button (`bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20`).

- [ ] **Step 4: Run component test to verify pass**

Run: `npx tsx --test tests/component/login-page.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/(auth)/login/page.tsx tests/component/login-page.test.tsx
git commit -m "feat(auth): implement curved split-screen dark editorial login design"
```

---

### Task 2: Full Verification & Production Build

**Files:**
- Test: `tests/component/login-page.test.tsx`

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: 307+ tests passing, 0 fails.

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
