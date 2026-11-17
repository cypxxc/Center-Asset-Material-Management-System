# UAT Test Plan (แผนการทดสอบการยอมรับระบบโดยผู้ใช้งาน)
**ระบบ:** CAMMS (Center Asset Material Management System)  
**เครื่องมือทดสอบ:** Autonomous Playwright Browser Engine (Chromium Real Browser)  
**ขอบเขต:** ทุกฟังก์ชันสำคัญ, เส้นทาง URL ทั้งหมด 9 เส้นทางหลัก, การทำงานของสิทธิ์ RBAC, และการแสดงผลบนอุปกรณ์เคลื่อนที่

---

## 1. Feature Inventory & Route Coverage Matrix

| Route Path | Module / Feature Name | User Role Scope | Test Scope |
|---|---|---|---|
| `/login` | Authentication Portal | All / Public | Form input validation, failure alert, session token generation |
| `/dashboard` | Dashboard & Analytics | Admin, User | KPI cards, acquisition trend charts, work queue |
| `/items` | Items & Asset Registry | Admin, User | Table rendering, search filters, pagination |
| `/items/new` | Asset Registration Form | Admin | Form validation, unit price, quantity, central flag toggle |
| `/disbursements`| Disbursement Workflow | Admin, User | Active borrows, document approvals, return tracking |
| `/central-items`| Central Items Catalog | Admin, User | Card view catalog, borrowing reservation |
| `/reports` | Asset & Financial Reports | Admin, User | Fiscal year export, category aggregations |
| `/locations` | Physical Locations | Admin | Building, room, department list |
| `/admin/users` | Account & RBAC Control | Admin only | User listing, role toggle, activity status |
| `/admin/audit-logs`| System Audit Logs | Admin only | Audit action filtering, diff inspector |
| `/settings` | System Settings & Master Data| Admin only | Categories, units, fiscal configurations |

---

## 2. Test Scenarios Definition

- **UAT-AUTH-01:** ตรวจสอบกระบวนการ Login ทั้งกรณีป้อนรหัสผิด และการ Login บัญชี Admin ด้วยรหัสผ่านที่ถูกต้อง
- **UAT-NAV-01:** ตรวจสอบการโหลดหน้าและแสดงผลหน้าหลักทั้งหมด 9 เส้นทางสำหรับ Admin (Dashboard, Items, Disbursements, Central Items, Reports, Locations, Users, Audit Logs, Settings)
- **UAT-CRUD-01:** ตรวจสอบวงจรข้อมูลครุภัณฑ์: เปิดฟอร์มสร้างครุภัณฑ์ใหม่, กรอกข้อมูลและบันทึก, ค้นหารายการในทะเบียนพัสดุ
- **UAT-RBAC-01:** ตรวจสอบการออกจากระบบ, การ Login ด้วยบัญชีผู้ใช้ทั่วไป (`user`), และการบังคับใช้สิทธิ์ห้ามเข้าถึง `/admin/users`
- **UAT-VISUAL-01:** ตรวจสอบการแสดงผลแบบ Responsive Layout บนขนาดหน้าจอโทรศัพท์เคลื่อนที่ (Mobile Viewport: 375x667)
