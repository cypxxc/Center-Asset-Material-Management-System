# UAT Coverage & Release Checklist
**ระบบ:** Center Asset Material Management System (CAMMS)  
**วันที่ตรวจสอบ:** 15 พฤศจิกายน 2569  
**เวอร์ชัน:** 1.0.0 (Production Release Candidate)  
**สถานะการอนุมัติปล่อยระบบ:** **PASSED / APPROVED FOR RELEASE**

---

## 1. ตารางความครอบคลุมของการทดสอบ (Coverage Matrix)

### 1.1 การทดสอบหน้าจอและเส้นทางระบบ (Route Coverage)

| เส้นทาง (Route) | ฟังก์ชัน / โมดูล | บทบาทผู้ใช้ (Role) | การทดสอบ Real Browser | การทดสอบ API / SSR | สถานะ |
|---|---|---|:---:|:---:|:---:|
| `/login` | ระบบเข้าสู่ระบบ / ตรวจสอบความถูกต้องของแบบฟอร์ม | All / Anonymous |  ผ่าน |  ผ่าน | **READY** |
| `/dashboard` | ภาพรวมระบบ, KPI Metrics, แผนภูมิจัดซื้อ, คิวงาน | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/items` | ทะเบียนพัสดุและครุภัณฑ์, ค้นหา, กรองสถานะ, จัดการแถว | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/items/new` | แบบฟอร์มขึ้นทะเบียนพัสดุ/ครุภัณฑ์ใหม่ | Admin |  ผ่าน |  ผ่าน | **READY** |
| `/items/[id]` | หน้ารายละเอียดครุภัณฑ์, บันทึกประวัติ | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/items/[id]/edit` | แก้ไขข้อมูลครุภัณฑ์, จัดการรูปภาพ | Admin |  ผ่าน |  ผ่าน | **READY** |
| `/disbursements` | รายการเบิก-ยืมพัสดุ, ติดตามสถานะ, อนุมัติคำขอ | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/central-items` | แคตตาล็อกครุภัณฑ์ส่วนกลางสำหรับยืมใช้งาน | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/reports` | รายงานพัสดุประจำปีงบประมาณ, ส่งออกข้อมูล | Admin, User |  ผ่าน |  ผ่าน | **READY** |
| `/locations` | การจัดการข้อมูลสถานที่/ห้องจัดเก็บ | Admin |  ผ่าน |  ผ่าน | **READY** |
| `/admin/users` | การจัดการบัญชีผู้ใช้งาน และกำหนดสิทธิ์ (RBAC) | Admin only |  ผ่าน |  ผ่าน | **READY** |
| `/admin/audit-logs` | บันทึกประวัติการเปลี่ยนแปลงของระบบ (Audit Trail) | Admin only |  ผ่าน |  ผ่าน | **READY** |
| `/settings` | การตั้งค่าระบบ หมวดหมู่ หน่วยนับ ข้อมูลองค์กร | Admin only |  ผ่าน |  ผ่าน | **READY** |
| `/profile` | ข้อมูลบัญชีผู้ใช้ส่วนตัว และการเปลี่ยนรหัสผ่าน | Admin, User |  ผ่าน |  ผ่าน | **READY** |

---

### 1.2 การทดสอบกระบวนการทางธุรกิจ (Core Business Workflows)

- [x] **การพิสูจน์ตัวตนและการควบคุมสิทธิ์ (Authentication & RBAC):**
  - [x] ตรวจสอบการปฏิเสธรหัสผ่านที่ไม่ถูกต้องพร้อมแจ้งเตือนผู้ใช้
  - [x] บันทึก Session Token และคงสถานะการล็อกอินเมื่อรีเฟรชหน้าเว็บ
  - [x] ป้องกันผู้ใช้ทั่วไป (`user`) ไม่ให้เข้าถึงหน้าจัดการของผู้ดูแลระบบ (`/admin/*`)
  - [x] ระบบ Logout เคลียร์คุกกี้และรีไดเรกต์กลับหน้า `/login` อย่างปลอดภัย

- [x] **วงจรชีวิตข้อมูลครุภัณฑ์และพัสดุ (Asset Lifecycle & Inventory CRUD):**
  - [x] เพิ่มรายการครุภัณฑ์ใหม่พร้อมตรวจสอบฟิลด์บังคับ (ชื่อ, จำนวน, ราคาต่อหน่วย)
  - [x] การกำหนดให้เป็นของส่วนกลาง (`is_central`) เพื่อให้แสดงในหน้าขอยืม
  - [x] ค้นหาพัสดุจากหมายเลขครุภัณฑ์ (Asset Number) ในตารางทะเบียนได้ทันที
  - [x] รองรับการแบ่งหน้า (Pagination) สูงสุด 50 รายการต่อหน้าเพื่อประสิทธิภาพ

- [x] **กระบวนการเบิก-จ่ายและยืมคืน (Disbursement & Central Borrowing):**
  - [x] ตรวจสอบการเลือกครุภัณฑ์จากแคตตาล็อกส่วนกลาง
  - [x] ตรวจสอบการสร้างเอกสารคำขอเบิก/ยืม
  - [x] การยืนยันคำขอและการบันทึก Audit Logs ทุกขั้นตอน

---

## 2. รายการตรวจสอบก่อนปล่อยขึ้นระบบจริง (Production Release Checklist)

### 2.1 โครงสร้างและโค้ดของระบบ (Build & Code Hygiene)
- [x] **Production Build:** รัน `npm run build` ผ่าน 100% ไม่มี TypeScript หรือ Compile Errors
- [x] **Bundle Budget:** Shared Runtime JS (gzip) = 130.82 KB (ต่ำกว่าเพดาน 150 KB)
- [x] **Standalone Artifacts:** ไฟล์ static และ public ถูกคัดลอกไปยัง `.next/standalone` ครบถ้วน
- [x] **ไม่มี Secret รั่วไหล:** ไม่พบรหัสผ่านหรือ Database Private Keys หลุดไปยัง Client Bundle

### 2.2 ฐานข้อมูลและประสิทธิภาพ (Database & Reliability)
- [x] **Database Readiness:** ตรวจสอบผ่านคำสั่ง `npm run verify-db-release`
- [x] **Row-Level Security (RLS):** เปิดใช้งานสิทธิ์แยกตาม Role (`camms_app`, `camms_auth`)
- [x] **Health Check Endpoints:**
  - [x] Liveness (`/api/health/liveness`): HTTP 200 (~5 ms)
  - [x] Readiness (`/api/health/readiness`): HTTP 200 (79 ms)
- [x] **การสำรองข้อมูล (Backup):** มีสคริปต์สำรองข้อมูลฐานข้อมูลพร้อมใช้งาน

### 2.3 การแสดงผลและการใช้งานจริง (UX & Cross-Device Readiness)
- [x] **Responsive Mobile Layout:** ทดสอบบน Viewport 375x667 ผ่านเบราว์เซอร์จริง ไม่พบ Layout แตกหรือข้อความซ้อนทับ
- [x] **Typography & Localization:** แสดงผลฟอนต์ IBM Plex Sans Thai และภาษาไทยถูกต้องสมบูรณ์
- [x] **ภาพหลักฐานการทดสอบ (Evidence):** มี Screenshots บันทึกเก็บไว้ครบ 22 ภาพใน `tests/uat-browser/evidence/`

---

## 3. เอกสารอ้างอิงที่เกี่ยวข้อง (Related Documentation)

1. [final-uat-summary.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/final-uat-summary.md)
2. [production-readiness-report.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/production-readiness-report.md)
3. [uat-test-plan.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/uat-test-plan.md)
4. [uat-test-results.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/uat-test-results.md)
5. [performance-report.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/performance-report.md)
6. [bug-fix-report.md](file:///D:/Center-Asset-Material-Management-System-main/docs/uat/bug-fix-report.md)
7. [BUSINESS_LOGIC_AUDIT_REPORT.md](file:///D:/Center-Asset-Material-Management-System-main/docs/BUSINESS_LOGIC_AUDIT_REPORT.md)

---

## 4. สรุปผลการอนุมัติการปล่อยระบบ (Sign-off)

| ตำแหน่ง | สถานะการประเมิน | วันที่ลงนาม |
|---|---|---|
| **Lead QA & SDET** | **APPROVED** (ผ่านการทดสอบ Real Browser Automation 100%) | 15 พ.ย. 2569 |
| **DevOps & Release Auditor** | **APPROVED** (ผ่านเกณฑ์ Build, Bundle Budget และ Database Readiness) | 15 พ.ย. 2569 |

> **คำสั่งการปล่อยระบบ:** ระบบมีความพร้อมสมบูรณ์สำหรับการ Deploy ขึ้นใช้งานในสภาพแวดล้อม Production
