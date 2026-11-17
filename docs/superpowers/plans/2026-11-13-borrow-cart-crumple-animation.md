# ระบบตะกร้าพัสดุและอนิเมชันขยำกระดาษโยนลงตะกร้า (Requisition Cart with Crumpled Paper Throw Animation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบตะกร้าสำหรับเลือกพัสดุ/ครุภัณฑ์ในหน้า "เบิกจ่าย เบิก/ยืม" (Borrow Catalog View) พร้อมเอฟเฟกต์อนิเมชันตอนกดเลือก โดยการจำลองการขยำการ์ดพัสดุเป็นก้อนกระดาษแล้วโยนโค้งลงตะกร้าอย่างนุ่มนวล พร้อมการเด้งตอบสนองของตะกร้าและ Drawer ตรวจสอบรายการ

**Architecture:** 
1. แยก Cart State ออกจาก Animation อย่างเด็ดขาด (Synchronous Optimistic State Update) ไม่บล็อกการคลิกของผู้ใช้
2. ใช้ Pure Web Animations API (WAAPI) และ CSS Keyframes สำหรับ Paper Crumple & Parabolic Flight โดยไม่ติดตั้ง library ภายนอกเพิ่มเติม เพื่อรักษา Bundle Budget ตามข้อกำหนด CAMMS
3. มีระบบ Cart Trigger และ Slide-Over Cart Drawer ให้ผู้ใช้เปิดดูรายการในตะกร้า, ลบทีละรายการ หรือล้างทั้งหมด ก่อนกดยืนยันคำขอเบิก/ยืม
4. ป้องกันความสับสน (Metaphor Trap) โดยใช้ดีไซน์ตะกร้าสีเขียว Emerald พร้อมไอคอนรถเข็น ShoppingCart และป้ายกำกับชัดเจน เพื่อไม่ให้เข้าใจผิดว่าเป็นถังขยะ (Trash/Wastebasket)

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Lucide React, Web Animations API

---

## Global Constraints
- Next.js 16 App Router & React 19 Client Component conventions (`'use client'`).
- Strict zero-dependency addition for bundle budget compliance (`scripts/check-bundle-budget.ts`).
- Full support for `prefers-reduced-motion` (skip projectile flight immediately).
- Thai language UI with IBM Plex Sans Thai typography and semantic CSS tokens (`bg-card`, `text-primary`, `border-border`, `text-card-foreground`).
- Maintain existing RBAC & submission logic (`submitBorrowRequest`).

---

## Review Focus
1. Rapid multi-click: ผู้ใช้กดเลือก 3-5 รายการติดต่อกันเร็วๆ ต้องไม่เกิดกระตุก และ trajectory ของแต่ละก้อนกระดาษต้องไม่ค้างหรือ drift
2. Scrolling during flight: ผู้ใช้เลื่อนหน้าจอขณะแอนิเมชันกำลังเล่น ก้อนกระดาษที่อยู่ใน fixed overlay ต้องร่อนลงพิกัดตะกร้าหรือ garbage collect อย่างถูกต้อง
3. Mobile viewport: ตะกร้าและอนิเมชันต้องทำงานลื่นไหลบนจอมือถือและแท็บเล็ต ไม่บดบังปุ่มสำคัญ
4. Unselect / Remove: การกดนำออกจากตะกร้า (ทั้งจากการ์ดและจากใน Cart Drawer) ต้องอัปเดต state ทันทีและสะท้อนสถานะปุ่มบนการ์ดอย่างถูกต้อง
5. Accessibility: Screen readers ต้องอ่านสถานะ `อยู่ในตะกร้าแล้ว` / `เพิ่มลงในตะกร้า` และรองรับ Reduced Motion

---

## Tasks

### Task 1: Create Paper Throw Animation Engine & Types
- [ ] สร้างโมดูล `features/disbursements/components/paper-throw-engine.tsx` สำหรับสร้างเอฟเฟกต์ขยำกระดาษและวิถีการโยน
- [ ] ออกแบบ CSS / SVG Keyframes:
  - Phase 1 (Crumple): Scale down (1.0 -> 0.3), rotate 45deg, faceted crinkle polygon, paper crease shadow
  - Phase 2 (Arc Toss): Parabolic trajectory Curve (Bezier) สู่พิกัดเป้าหมาย พร้อมหมุน 540deg
  - Phase 3 (Basket Fall & Fade): Scale to 0.1 เข้าสู่ศูนย์กลางตะกร้า และ trigger `onArrive`
- [ ] ใส่การตรวจจับ `prefers-reduced-motion` เพื่อ bypass ทันทีเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว
- [ ] เขียน unit test สำหรับ helper functions / animation coordinates

### Task 2: Create Borrow Cart Drawer Component
- [ ] สร้างโมดูล `features/disbursements/components/borrow-cart-drawer.tsx`
- [ ] รองรับการแสดงผล:
  - Header: หัวข้อ "ตะกร้าพัสดุสำหรับเบิก/ยืม", จำนวนที่เลือก (สูงสุด 20), ปุ่ม "ล้างตะกร้า"
  - Item List: รูปภาพขนาดย่อ, ชื่อพัสดุ, หมายเลขครุภัณฑ์, หมวดหมู่, ปุ่มลบออกจากตะกร้า
  - Empty State: แสดงไอคอน ShoppingCart ว่างเปล่าและข้อความแนะนำ
  - Footer: ปุ่ม "ดำเนินการเบิก/ยืม" (เปิด modal คำขอ) และปุ่ม "ปิด"
- [ ] รองรับ Keyboard navigation (Esc เพื่อปิด) และ accessibility attributes (`role="dialog"`, `aria-label`)

### Task 3: Create Borrow Cart Floating Trigger & Badge
- [ ] สร้างโมดูล `features/disbursements/components/borrow-cart-button.tsx`
- [ ] มีอนิเมชันตอบสนองการตกของกระดาษ:
  - Bounce & Jiggle animation ("เด้งดึ๋ง") เมื่อก้อนกระดาษตกลงสู่ตะกร้า
  - Counter badge pop animation (+1 count)
- [ ] ปรับดีไซน์ให้ดูเป็น "ตะกร้าพัสดุสำหรับเบิกยืม" ชัดเจน (ไม่ใช่ถังขยะ) ด้วยโทนสี Emerald / Primary, ไอคอน ShoppingCart, และเงา backdrop-blur

### Task 4: Integrate Cart System into `BorrowCatalogView`
- [ ] อัปเดต `features/disbursements/components/borrow-catalog-view.tsx`:
  - ผูก state การเลือก (`selectedIds`) เข้ากับ Cart System
  - อัปเดตปุ่มบนการ์ดพัสดุ: แสดง `+ ใส่ตะกร้า` เมื่อยังไม่ได้เลือก และ `อยู่ในตะกร้าแล้ว` เมื่อเลือกแล้ว
  - เมื่อคลิกปุ่ม "ใส่ตะกร้า" ให้ดึง bounding rect ของการ์ด/ปุ่ม และยิงอนิเมชันขยำกระดาษไปยัง Cart Button
  - ผูก Cart Drawer เข้ากับ Modal การยืนยันคำขอเบิก/ยืมเดิม (`submitBorrowRequest`)
- [ ] ปรับปรุงการจัดการ Cart ทั้งบน Desktop และ Mobile

### Task 5: Verification & Quality Assurance
- [ ] ตรวจสอบ TypeScript compilation (`npm run typecheck`)
- [ ] รันการทดสอบ unit/component test ที่เกี่ยวข้อง
- [ ] ตรวจสอบ Performance & Bundle budget
- [ ] ทดสอบ Edge cases: การกดเลือกซ้ำๆ รวดเร็ว, การลบรายการจาก Drawer, การล้างตะกร้า, และ Reduced Motion mode
