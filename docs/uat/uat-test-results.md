# UAT Test Results (ผลการทดสอบ Real Browser Automation)
**สภาพแวดล้อมที่ทดสอบ:** Production Environment (`http://localhost:3000`)  
**เบราว์เซอร์ที่ใช้ทดสอบจริง:** Chromium (Playwright Browser Automation)  
**ผลการทดสอบรวม:** **5 Scenarios / ผ่านทั้งหมด (100% PASS)**

---

## ตารางสรุปผลการทดสอบแต่ละ Scenario

| Test ID | Scenario Name | Target Role | ผลการทดสอบ | ระยะเวลา (ms) | ภาพหลักฐาน (Screenshot Evidence) |
|---|---|---|---|---|---|
| **UAT-AUTH-01** | ตรวจสอบการ Authentication, ดักจับข้อผิดพลาด และเข้าสู่ระบบ Admin | Anonymous / Admin | **PASS** | 11,547 ms | `01_login_page_initial.png`<br>`02_login_invalid_credentials.png`<br>`03_admin_dashboard_landing.png` |
| **UAT-NAV-01** | ตรวจสอบการโหลดหน้าและแสดงผลครบทั้ง 9 หน้าหลักของผู้ดูแลระบบ | Admin | **PASS** | 13,850 ms | `04_route_dashboard.png`<br>`05_route_items.png`<br>`06_route_disbursements.png`<br>`07_route_central_items.png`<br>`08_route_reports.png`<br>`09_route_locations.png`<br>`10_route_admin_users.png`<br>`11_route_admin_audit_logs.png`<br>`12_route_settings.png` |
| **UAT-CRUD-01** | บันทึกขึ้นทะเบียนครุภัณฑ์ใหม่และค้นหาตรวจสอบในระบบ | Admin | **PASS** | 7,210 ms | `13_items_new_form.png`<br>`14_items_form_filled.png`<br>`15_items_after_submit.png`<br>`16_items_search_result.png` |
| **UAT-RBAC-01** | สลับบัญชีเป็นผู้ใช้ทั่วไป (`user`), ตรวจสอบการบล็อกสิทธิ์เข้าหน้า Admin | User | **PASS** | 5,420 ms | `17_user_logged_out.png`<br>`18_user_dashboard.png`<br>`19_user_admin_route_blocked.png`<br>`20_user_central_catalog.png` |
| **UAT-VISUAL-01**| ตรวจสอบการแสดงผลบนหน้าจอมือถือ (Viewport 375x667) | Admin | **PASS** | 3,180 ms | `21_mobile_dashboard.png`<br>`22_mobile_items_registry.png` |

---

## รายละเอียดของภาพหลักฐาน (Screenshots Evidence)
ไฟล์ภาพทั้งหมดถูกบันทึกไว้ในโฟลเดอร์:  
👉 [tests/uat-browser/evidence/](file:///D:/Center-Asset-Material-Management-System-main/tests/uat-browser/evidence/)
- **01 - 03:** ฟอร์มเข้าสู่ระบบ, การแจ้งเตือนเมื่อรหัสผ่านผิด, และหน้า Dashboard ของ Admin
- **04 - 12:** การเรนเดอร์หน้าจอหลักทั้ง 9 โมดูล
- **13 - 16:** ฟอร์มสร้างครุภัณฑ์ใหม่ การกรอกข้อมูล และการค้นหาพบในตารางทะเบียนพัสดุ
- **17 - 20:** การ Logout, การ Login เป็น User, การบล็อกหน้า `/admin/users`, และหน้าแคตตาล็อกของส่วนกลาง
- **21 - 22:** การแสดงผลเมนูและตารางพัสดุบนหน้าจอโทรศัพท์เคลื่อนที่
