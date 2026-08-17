# Login Page Split-Screen Enterprise Redesign Design Specification

## 1. Overview
Redesign the CAMMS login experience (`app/(auth)/login/page.tsx`) from a basic centered card into an **Official Enterprise Split-Screen Workspace**. The new design reflects the product's calm, precise, and official character, providing clear branding, system status transparency, and a smooth, accessible authentication interface.

---

## 2. Layout & UI/UX Specifications

### 2.1 Desktop Layout (`lg:grid lg:grid-cols-12 min-h-screen`)
- **Left Brand & Operational Panel (`lg:col-span-5 xl:col-span-4 bg-slate-950 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden`)**:
  - **Header**: CAMMS Emblem / Official Package Icon with subtle border, System Name ("CAMMS — Center Asset & Material Management System").
  - **Body**: 
    - Mission summary: "ระบบทะเบียนสิ่งของและครุภัณฑ์สำนักงานสำหรับการจัดเก็บ ตรวจสอบ และบริหารจัดการพัสดุอย่างเป็นระเบียบ"
    - Key capability highlights (Calm list with subtle badges):
      - 🏷️ ทะเบียนครุภัณฑ์และวัสดุสำนักงานครบวงจร
      - 🔐 ควบคุมสิทธิ์การเข้าถึงตามระดับบทบาท (RBAC)
      - 🖨️ พิมพ์ป้ายสติกเกอร์รหัสทรัพย์สินและ QR Code
  - **Footer**:
    - Live System Status badge (`● สถานะระบบ: พร้อมใช้งานปกติ` with pulsing emerald dot).
    - Security notice regarding official access only.

- **Right Interactive Login Surface (`lg:col-span-7 xl:col-span-8 bg-slate-50 flex items-center justify-center p-6 sm:p-12`)**:
  - Form Container (`w-full max-w-[440px] bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm` on mobile / seamless on desktop).
  - Welcome greeting: "เข้าสู่ระบบ (Sign In)" with sub-label "กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ".
  - **Input Fields**:
    - **ID / Email / Name Field**: Left icon (`User`), clear placeholder, autoFocus/keyboard reachable.
    - **Password Field**: Left icon (`Lock`), password toggle button (`Eye`/`EyeOff`), clear labels.
  - **Error Messages**:
    - Alert banner for inactive accounts (`?error=inactive`).
    - Server action error banner for invalid credentials.
  - **Action Button**: Primary button with loading indicator (`isPending`), active scale transition.
  - **Footer / Support**: Contact administrator information and copyright disclaimer.

### 2.2 Mobile & Responsive Behavior (`< lg`)
- Stacks gracefully into a single-column layout.
- The top header renders a compact dark branding strip, followed by the main login form card below.

---

## 3. Technical Implementation & Components

### 3.1 Files Modified / Created
- `app/(auth)/login/page.tsx`: Update login layout to split-screen structure.
- `tests/component/login-page.test.tsx`: Add/update component tests verifying split-screen elements, status badge, input bindings, error states, and password visibility toggle.

### 3.2 Security & Data Protection
- Keeps form action `login` in `features/auth/actions.ts` untouched.
- No client-side credentials logging.
- Proper sanitization of search params and error feedback.

---

## 4. Verification & Testing Strategy
- Unit & Component tests (`tests/component/login-page.test.tsx`):
  - Form renders branding, inputs, and status badge.
  - Inactive account banner renders when `error=inactive`.
  - Password visibility toggles between text and password types.
- Pipeline check:
  - `npm test` (all tests passing).
  - `npm run typecheck` (0 TypeScript errors).
  - `npm run lint` (0 lint errors).
  - `npm run build` (Production build succeeds).
