# Curved Split-Screen Dark Editorial Login Design Specification

## 1. Overview & Vision
Transform the CAMMS login experience (`app/(auth)/login/page.tsx`) into an immersive **Curved Split-Screen Dark Editorial Workspace**. The design blends a solid dark charcoal form panel on the left with a dark atmospheric landscape on the right, separated by an organic vector wave divider with a subtle glowing dashed trace line.

---

## 2. Visual Architecture & Layout Breakdown

### 2.1 Desktop Split Grid (`min-h-screen w-full lg:grid lg:grid-cols-12 bg-[#1A1D26] text-white relative overflow-hidden`)
- **Left Form Panel (`lg:col-span-6 xl:col-span-5 bg-[#1E222D] p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative z-20 shadow-2xl`)**:
  - **Brand Header**:
    - Electric Blue circular dot indicator + CAMMS monogram emblem.
    - System Title: `CAMMS` (`text-xl font-bold text-white tracking-tight`).
    - Subtitle: `Center Asset Material Management System` (`text-xs text-slate-400`).
  - **Main Login Form Module**:
    - Uppercase tracking kicker: `ยินดีต้อนรับเข้าสู่ระบบ • OFFICIAL PORTAL` in `text-[11px] font-semibold text-slate-400 tracking-wider`.
    - Headline: `เข้าสู่ระบบจัดการพัสดุและครุภัณฑ์` + signature bright sky-blue dot (`text-2xl sm:text-3xl font-bold text-white tracking-tight`).
    - Sub-text: `กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ` with support link (`text-xs text-slate-400`).
    - Error banners: Localized rose banners for inactive account (`?error=inactive`) and credentials error.
    - **Form Inputs**:
      - ID / Email / Username: Full width, dark background (`bg-[#2A2E3B] border border-slate-700/80 rounded-xl h-11 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20`), right-aligned User icon.
      - Password: Full width, dark background (`bg-[#2A2E3B] border border-slate-700/80 rounded-xl h-11 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20`), right-aligned Eye/EyeOff toggle button.
    - **Submit Button**:
      - Pill-shaped button (`bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-full h-11 shadow-lg shadow-sky-500/25 active:scale-[0.99] transition-all`).
  - **Footer & Security Notice**:
    - Status indicator: `● ระบบความปลอดภัยพร้อมใช้งาน (256-bit Encrypted Session)` in muted text.
    - Copyright line: `© 2026 CAMMS. สงวนลิขสิทธิ์ทั้งหมด`.

- **Organic Wave Divider (SVG Transition Between Left & Right Panels)**:
  - Responsive SVG vertical wave placed on the right edge of the left panel or overlaying the border.
  - S-curve path filled with `#1E222D`.
  - Secondary decorative dashed stroke path (`stroke="rgba(56, 189, 248, 0.3)" stroke-dasharray="4 6"`).

- **Right Backdrop Panel (`lg:col-span-6 xl:col-span-7 relative hidden lg:block overflow-hidden`)**:
  - Atmospheric dark mountain/forest landscape backdrop with subtle dark gradient overlay (`bg-gradient-to-t from-[#1A1D26] via-transparent to-black/40`).
  - Bottom-Right Watermark Seal: Minimalist white translucent CAMMS badge (`CAMMS • v1.0.0`) in `text-xs text-white/50`.

### 2.2 Mobile & Tablet Layout (`< lg`)
- Fluid single column on `#1E222D` background.
- Compact header with blue glow accent and organic curve motif at the bottom.

---

## 3. Technical Implementation & Components
- Update `app/(auth)/login/page.tsx` with the curved split layout.
- Update `tests/component/login-page.test.tsx` to verify CAMMS branding, headline with blue accent, inputs, buttons, and password toggle.
- Verify through `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
