# Task-First Sidebar Design

## Goal

Make the CAMMS desktop sidebar match office inventory work: begin with records, use filters when needed, and isolate administrator-only tools.

## Structure

1. **งานหลัก:** แผงควบคุม, รายการทั้งหมด, ครุภัณฑ์, วัสดุสิ้นเปลือง, สถานที่, รายงาน.
2. **ตัวกรอง:** expandable หมวดหมู่ครุภัณฑ์ and สถานที่ lists, collapsed by default.
3. **ผู้ดูแลระบบ:** ตั้งค่าระบบ for editors, and ประวัติการทำรายการ plus จัดการฐานข้อมูล for admins.

The editor-only `ขึ้นทะเบียนใหม่` action appears above the main navigation. Labels are Thai-first.

## Interaction

- Parent links and expand/collapse buttons are separate controls.
- Expanders carry accessible names and `aria-expanded`.
- Active routes remain visibly indicated.
- No route, role, query, or Supabase data behavior changes.

## Verification

- Test links, role gates, and expander keyboard semantics.
- Verify the default sidebar has collapsed filter lists and no nested interactive elements.
- Run TypeScript and ESLint checks.
