# Swiss Editorial & Warm Alabaster Login Redesign Specification

## 1. Overview & Aesthetic Vision
Redesign the CAMMS authentication screen (`app/(auth)/login/page.tsx`) following a **Swiss Editorial & Warm Alabaster** aesthetic. The design emphasizes calm official luxury, generous architectural whitespace, razor-sharp typography, and pure tactile interaction without decorative clutter, gradient fills, or marketing-style badges.

---

## 2. Layout & Typography Architecture

### 2.1 Canvas & Ambient Surface
- **Background**: Soft Warm Alabaster (`bg-[#F9FAFB]` / `bg-slate-50/80`) with fine architectural depth and ample breathing room.
- **Card Container**:
  - `w-full max-w-[420px]` centered vertically and horizontally.
  - Pure white surface (`bg-white`), precision 1px border (`border-slate-200/90`), subtle diffused ambient shadow (`shadow-[0_20px_60px_-15px_rgba(15,23,42,0.05)]`), `rounded-2xl`.
  - Padding: `p-8 sm:p-10`.

### 2.2 Header & Brand Monogram
- **Emblem**: Minimalist geometric black monogram emblem with crisp CAMMS Package glyph (`h-11 w-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-sm`).
- **Typography Hierarchy**:
  - Primary Brand: **CAMMS** (`text-lg font-bold tracking-tight text-slate-950`).
  - System Sub-label: **Center Asset & Material Management System** (`text-[11px] font-medium text-slate-500 tracking-wide`).
  - Editorial Divider: Fine 1px divider with subtle margin.
  - Action Title: **เข้าสู่ระบบ** (`text-xl font-bold tracking-tight text-slate-900`).
  - Action Description: "ระบุรหัสผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบ" (`text-xs text-slate-500`).

### 2.3 Form Fields & Micro-interactions
- **Labels**: Micro-typography (`text-[11px] font-semibold text-slate-600 uppercase tracking-wider`).
- **Inputs**:
  - Height `h-11`, clean white background (`bg-white` / `bg-slate-50/40 on idle`).
  - Border: `border-slate-200`.
  - Focus State: `focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 focus:bg-white` with smooth 150ms ease transition.
  - Left Icon: `User` and `Lock` in `text-slate-400`.
  - Password Visibility: `Eye` / `EyeOff` button with smooth hover and accessible `aria-label`.
- **Button**:
  - Deep Obsidian Black (`bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold text-sm rounded-xl h-11 shadow-xs transition-all`).
  - Disabled / Pending state with loading spinner.

### 2.4 Error & Status States
- Inactive Account & Credentials Error: Subtle rose banner (`bg-rose-50/80 border border-rose-200/80 text-rose-800 text-xs rounded-xl p-3.5`).
- Quiet Security Status: `● ระบบความปลอดภัยพร้อมใช้งาน (Security Verified)` in refined muted text.
- Version Stamp: `CAMMS v1.0.0 — สงวนลิขสิทธิ์ทั้งหมด`.

---

## 3. Verification & Testing
- Component test in `tests/component/login-page.test.tsx` verifying typography, brand seal, inputs, and password toggle.
- Verification pipeline: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
