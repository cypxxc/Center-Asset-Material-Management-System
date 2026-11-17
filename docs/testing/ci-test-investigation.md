# รายงานการตรวจสอบและแก้ไขปัญหา CI Test (CI Test Investigation Report)

**โครงการ:** Center Asset & Material Management System (CAMMS)  
**วันที่ดำเนินการ:** 17 พฤศจิกายน 2569  
**สถานะ:** เสร็จสมบูรณ์ (0 failed tests, 0 unexpected skipped tests, CI workflow updated, Build & Typecheck ผ่าน 100%)

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

จากการตรวจสอบระบบ CI/CD และชุดการทดสอบทั้งหมดของระบบ CAMMS (237 ไฟล์ทดสอบ) พบปัญหาหลัก 3 ประการที่ทำให้ CI ล้มเหลวและมีผลการทดสอบถูกข้าม (skipped):
1. **Playwright Chromium หายไปในขั้นตอน `npm test` บน GitHub Actions:** ลำดับการติดตั้งเบราว์เซอร์ Chromium ใน Job `build` ถูกวางไว้หลังคำสั่ง `npm test` ทำให้การทดสอบหน่วยที่เรียกใช้ headless browser (`lib/image-crop.test.ts` และ `components/ui/image-crop-dialog.test.tsx`) เกิดข้อผิดพลาดและทำให้ CI จบด้วยรหัส Exit Code 1
2. **การทดสอบ Integration ถูกข้าม 29 รายการ (29 Skipped Tests):** เกิดจากการขาดการตั้งค่า Environment Flags และไม่ได้รวมขั้นตอนการรัน Live Integration Tests เข้ากับ PostgreSQL Service แบบแยกส่วน (Isolated Service Container) ใน CI
3. **ความไม่สอดคล้องของ Test Scenarios กับ Database Invariants ปัจจุบัน:** หลังการแยกประเภทวัสดุและครุภัณฑ์ (Migration 0005), ระบบหักสต็อกทันที (Migration 0009), และ Trigger ป้องกันการแก้ไขเอกสาร (Migration 0011) พบว่าการทดสอบ Live Integration บางไฟล์ยังคงพยายาม Insert ข้อมูลวัสดุลงในตาราง `items`, มีการใส่ข้อมูลอนุมัติเอกสารไม่ครบถ้วน, หรือการจับ Regular Expression ข้อความข้อผิดพลาดไม่ตรงกับ Business Rules ปัจจุบัน

ทีมงานได้ดำเนินการแก้ไขทั้งในส่วนของ CI Workflow (`.github/workflows/ci.yml`), Logic การจัดกลุ่มคำขอเบิก-ยืม (`features/disbursements/postgres-actions.ts`), และปรับปรุง Test Scenarios ทั้ง 10 ไฟล์ให้สอดคล้องกับ Invariants ของระบบอย่างเคร่งครัด โดยไม่มีการลบ ปิด หรือลดทอนความเข้มงวดของการทดสอบใดๆ ทั้งสิ้น

---

## 2. การวิเคราะห์สาเหตุเชิงลึกและการแก้ไข (Root Cause Analysis & Fixes)

### 2.1 ปัญหา Playwright Chromium ใน CI (`build` Job)
* **สาเหตุ:** ใน `.github/workflows/ci.yml` บรรทัดที่ 42 เรียก `npm test` แต่ขั้นตอน `npx playwright install --with-deps chromium` อยู่ที่บรรทัด 50 ส่งผลให้การทดสอบที่พึ่งพา Chromium ล้มเหลว
* **การแก้ไข:** ย้ายขั้นตอน `Install Playwright Browsers` (`npx playwright install --with-deps chromium`) ให้ทำงานก่อน `npm test` ใน Job `build`

### 2.2 ปัญหา 29 Skipped Tests
จากการสแกนเงื่อนไข `{ skip: ... }` พบว่ามีทั้งหมด 24 ไฟล์ที่ครอบคลุม 29 การทดสอบที่ถูกข้าม:
* **กลุ่มที่ 1: Live Feature Tests (8 การทดสอบ)**
  * `features/disbursements/material-borrow-live.test.ts`
  * `features/disbursements/material-concurrency-live.test.ts`
  * `features/disbursements/material-issue-live.test.ts`
  * `features/disbursements/material-stock-owner-live.test.ts`
  * `features/disbursements/postgres-actions-live.test.ts`
  * `features/items/asset-register-live.test.ts`
  * `features/materials/stock-postgres-live.test.ts`
  * `features/reports/completed-disbursement-sql.test.ts`
* **กลุ่มที่ 2: Live Integration Tests (16 การทดสอบ)**
  * `features/items/postgres-queries-live.test.ts`
  * `tests/integration/acquisition-queries.test.ts` (2 tests)
  * `tests/integration/admin-work-queue.test.ts`
  * `tests/integration/item-archive-live.test.ts`
  * `tests/integration/import-duplicate-feedback.test.ts`
  * `tests/integration/material-separation.test.ts`
  * `tests/integration/category-types-migration.test.ts`
  * `tests/integration/navicat-password-live.test.ts`
  * `tests/integration/postgres-admin-live.test.ts`
  * `tests/integration/postgres-admin-restore-live.test.ts`
  * `tests/integration/postgres-disbursement-actions-live.test.ts`
  * `tests/integration/postgres-disbursement-flow-live.test.ts`
  * `tests/integration/postgres-disbursement-migration-live.test.ts`
  * `tests/integration/postgres-null-email-live.test.ts`
  * `tests/integration/user-role-migration-live.test.ts`
* **กลุ่มที่ 3: Browser UI/Agent Synthetic Tests (5 การทดสอบ)**
  * `tests/integration/ai-dom-extractor-browser.test.ts` (ใช้สำหรับ Autonomous AI UAT harness โดยเฉพาะ มีเงื่อนไขข้ามเมื่อไม่ได้ระบุ `AI_UAT_BROWSER_TEST=1`)

**การแก้ไขใน CI:**
กำหนด Environment Variables ให้ครบถ้วนใน Job `postgres-release` ได้แก่:
`DATA_BACKEND=postgres`, `POSTGRES_ADMIN_LIVE_TEST=1`, `POSTGRES_QUERY_INTEGRATION=1`, `POSTGRES_HTTP_INTEGRATION=1`, `POSTGRES_RECOVERY_INTEGRATION=1`, `MATERIAL_BORROW_INTEGRATION=1`, `COMPLETED_CHART_SQL_TEST=1`, `POSTGRES_ACQUISITION_LIVE_TEST=1`, `POSTGRES_ADMIN_QUEUE_LIVE_TEST=1`, `POSTGRES_ITEM_ARCHIVE_LIVE_TEST=1`, `POSTGRES_LIVE_TEST=1`, `MATERIAL_MIGRATION_TEST=1`, `POSTGRES_NULL_EMAIL_LIVE_TEST=1`
พร้อมสั่งรันชุดทดสอบจริงผ่านคำสั่ง `node --test-concurrency=1 --import tsx --test ...`

---

### 2.3 การปรับแก้โค้ดและการทดสอบให้ตรงกับ Invariants

#### 1) แยกคำขอเบิก/ยืมในตะกร้ารวม (Disbursement Cart Splitting)
* **ไฟล์:** `features/disbursements/postgres-actions.ts`
* **ปัญหา:** เมื่อผู้ใช้ส่งคำขอแบบผสมที่มีทั้งวัสดุและครุภัณฑ์ โดยไม่ได้ระบุ `item_actions` รายชิ้น ระบบเดิมดึงค่า `input.request_type` มาใช้ ทำให้วัสดุถูกจัดเป็นประเภท `asset_borrow` รวมกับครุภัณฑ์ ได้เอกสารเพียง 1 ฉบับ แทนที่จะแยกเป็น `material_issue` และ `asset_borrow`
* **การแก้ไข:**
  * กำหนดให้วัสดุในตะกร้าที่ไม่ได้ระบุ action เจาะจงมีค่าเริ่มต้นเป็น `'issue'` เสมอ
  * หากมีการพยายามส่งคำขอแบบ `request_type === 'issue'` แต่ระบุ `item_actions` ของวัสดุเป็น `'borrow'` ระบบจะปฏิเสธด้วยข้อผิดพลาด `'ไม่สามารถยืมวัสดุในคำขอเบิกได้'` อย่างถูกต้อง

#### 2) การปฏิบัติตามกฎ Material & Asset Separation (Invariant 1)
* **ไฟล์:**
  * `tests/integration/postgres-disbursement-actions-live.test.ts`
  * `tests/integration/postgres-disbursement-flow-live.test.ts`
* **ปัญหา:** ตัวทดสอบเดิมยังคง Insert วัสดุ (`item_type = 'material'`) ลงในตาราง `public.items` ทำให้ละเมิด Check Constraint `items_type_check` ของ Migration 0005
* **การแก้ไข:** ปรับเปลี่ยนการ Insert ข้อมูลวัสดุลงใน `public.materials` และครุภัณฑ์ลงใน `public.items` ตามข้อกำหนดทางสถาปัตยกรรมอย่างถูกต้อง

#### 3) ข้อกำหนด Metadata ในการอนุมัติเอกสาร (Rule 0011)
* **ไฟล์:** `tests/integration/postgres-disbursement-migration-live.test.ts`
* **ปัญหา:** Trigger `protect_disbursement_header_immutability()` ตรวจสอบว่าการเปลี่ยนสถานะเอกสารเป็น `confirmed` จะต้องมี `document_no`, `fiscal_year`, `confirmed_at`, และ `confirmed_by` ครบถ้วน ตัวทดสอบเดิม Update เพียงสถานะและเวลา ทำให้ถูกปฏิเสธด้วยข้อความ `Approval metadata is required`
* **การแก้ไข:** เพิ่ม `confirmed_by`, `document_no`, และ `fiscal_year` ในคำสั่ง Update เพื่อให้ผ่านเงื่อนไขความถูกต้องของ Trigger

#### 4) กฎการตัดสต็อกทันที (Rule 0009: Immediate Stock Deduction)
* **ไฟล์:** `tests/integration/postgres-disbursement-actions-live.test.ts`
* **ปัญหา:** ระบบ CAMMS ตัดสต็อกวัสดุทันทีที่มีการส่งคำขอ (`draft` -> `pending_approval`) และจะไม่ตัดซ้ำเมื่ออนุมัติ ในขณะที่ตัวทดสอบเดิมคาดหวังว่ายอดสต็อกจะไม่ถูกตัดจนกว่าจะอนุมัติ
* **การแก้ไข:** ปรับปรุงค่า Assertion ของสต็อกให้สอดคล้องกับ Rule 0009 โดยตรวจสอบว่ายอดสต็อกตัดทันทีที่สร้างคำขอ และคืนสต็อกเมื่อยกเลิกคำขอ

#### 5) Drizzle Identifier Quoting และ Temp Table Replacements
* **ไฟล์:**
  * `tests/integration/acquisition-queries.test.ts`
  * `tests/integration/item-archive-live.test.ts`
* **ปัญหา:**
  * ใน `acquisition-queries.test.ts` คำสั่ง SQL ใช้ `public.inventory_items` แต่ regex แทนที่เฉพาะ `public.items`
  * ใน `item-archive-live.test.ts` Drizzle ORM ทำการ escape ชื่อตารางเป็น `public."items"` ทำให้ `replaceAll('public.items', ...)` แทนที่ไม่สำเร็จและไปคิวรีตารางจริงที่ว่างเปล่า
* **การแก้ไข:** ปรับปรุง Regex Replacement ให้รองรับทั้ง quoted identifier `public.("?items"?)` และ `public.(inventory_)?items`

#### 6) การรัน Migration แบบต่อเนื่องใน Disposable Database
* **ไฟล์:** `tests/integration/material-separation.test.ts`
* **ปัญหา:** ตัวทดสอบรัน Migration 0000-0005 แต่ตอนท้ายทดสอบ Application Action ล่าสุดที่ต้องการคอลัมน์จาก Migration 0011 (`submitted_at`)
* **การแก้ไข:** ให้รัน Migration 0006-0013 ต่อเนื่องหลังจากทดสอบ Migration 0005 เสร็จสิ้น เพื่อให้โครงสร้างฐานข้อมูลสมบูรณ์พร้อมสำหรับการทดสอบ Application Logic

#### 7) การตั้งค่า Concurrency ของ Node Test Runner
* **ไฟล์:** `.github/workflows/ci.yml`
* **ปัญหา:** `node --test` มีพฤติกรรมรันไฟล์ทดสอบแบบขนาน (parallel) ทำให้การทดสอบที่คำนวณยอดรวมระบบ (`reports.getPostgresReportStats()`) ชนกับข้อมูลที่ถูก Insert จากไฟล์ทดสอบอื่นในเวลาเดียวกัน
* **การแก้ไข:** เพิ่ม Flag `--test-concurrency=1` สำหรับชุดการทดสอบ Live Database Integration เพื่อรันเรียงลำดับ ป้องกัน Race Condition บนฐานข้อมูลเดียวกัน

---

## 3. ผลการทดสอบจริง (Actual Verification Results)

### 3.1 ผลการทดสอบ PostgreSQL Live Feature Tests (8/8 ผ่าน 100%)
```bash
cmd /c "set POSTGRES_QUERY_INTEGRATION=1&& set MATERIAL_BORROW_INTEGRATION=1&& set COMPLETED_CHART_SQL_TEST=1&& node --import tsx --test features/disbursements/material-borrow-live.test.ts features/disbursements/material-concurrency-live.test.ts features/disbursements/material-issue-live.test.ts features/disbursements/material-stock-owner-live.test.ts features/disbursements/postgres-actions-live.test.ts features/items/asset-register-live.test.ts features/materials/stock-postgres-live.test.ts features/reports/completed-disbursement-sql.test.ts"
```
**ผลลัพธ์:**
```text
✔ material borrowing debits once, returns partially, reverses and restores rejected requests (2037.9681ms)
✔ two ordinary users cannot deduct 4 + 4 from stock 5 concurrently (1910.5103ms)
✔ material quantity reservations, cancellation, approval and reversal round-trip with rollback (3643.0361ms)
✔ owner restoration of pending material snapshots does not replay stock deductions (285.4747ms)
✔ PostgreSQL disbursement business logic executes safely with real database rollbacks (1456.4179ms)
✔ asset register create/edit/import and inventory projections round-trip in PostgreSQL (1451.4575ms)
✔ material stock documents protect metadata, retries, counts, partial returns and reconciliation (1645.984ms)
✔ SQL counts successful documents using handover or approval date, including returned loans, in Bangkok time (51.1662ms)
ℹ tests 8 | pass 8 | fail 0 | duration_ms 5073.2355
```

### 3.2 ผลการทดสอบ All Live Integration Tests (25/25 ผ่าน 100%)
```bash
cmd /c "set DATA_BACKEND=postgres&& set POSTGRES_ADMIN_LIVE_TEST=1&& set POSTGRES_QUERY_INTEGRATION=1&& set POSTGRES_HTTP_INTEGRATION=1&& set POSTGRES_RECOVERY_INTEGRATION=1&& set MATERIAL_BORROW_INTEGRATION=1&& set COMPLETED_CHART_SQL_TEST=1&& set POSTGRES_ACQUISITION_LIVE_TEST=1&& set POSTGRES_ADMIN_QUEUE_LIVE_TEST=1&& set POSTGRES_ITEM_ARCHIVE_LIVE_TEST=1&& set POSTGRES_LIVE_TEST=1&& set MATERIAL_MIGRATION_TEST=1&& set POSTGRES_NULL_EMAIL_LIVE_TEST=1&& node --test-concurrency=1 --import tsx --test ..."
```
**ผลลัพธ์:**
```text
✔ material borrowing debits once, returns partially, reverses and restores rejected requests (466.6084ms)
✔ two ordinary users cannot deduct 4 + 4 from stock 5 concurrently (498.301ms)
✔ material quantity reservations, cancellation, approval and reversal round-trip with rollback (1317.3356ms)
✔ owner restoration of pending material snapshots does not replay stock deductions (44.7495ms)
✔ PostgreSQL disbursement business logic executes safely with real database rollbacks (611.4493ms)
✔ asset register create/edit/import and inventory projections round-trip in PostgreSQL (737.2874ms)
✔ PostgreSQL query feature surface executes against real restricted-role SQL (1156.6258ms)
✔ material stock documents protect metadata, retries, counts, partial returns and reconciliation (725.9317ms)
✔ SQL counts successful documents using handover or approval date, including returned loans, in Bangkok time (33.9048ms)
✔ PostgreSQL acquisition aggregation handles missing/future dates, prices and deleted rows (45.2237ms)
✔ acquisition query preserves PostgreSQL RLS for an unauthenticated connection (24.2362ms)
✔ admin queue counts beyond display limit and excludes due-today, returned and exhausted loans (50.1442ms)
✔ category migration preserves shared, exclusive, unused and archived references and enforces types (67.193ms)
✔ importPostgresItems detects intra-file duplicate asset numbers and reports row numbers (787.7765ms)
✔ importPostgresItems detects collisions against existing database records and lists details (66.8ms)
✔ archive keeps closed history/images and blocks all selected rows when one has open work (101.1709ms)
✔ material separation preserves UUIDs, history, RLS and physical stock ownership (777.4312ms)
✔ Navicat password input is atomic, private, owner-only, and usable for login (2775.2234ms)
✔ live restricted roles support account, session, audit and business administration (1459.9797ms)
✔ fresh database migrates twice and real business restore commits or rolls back atomically (2176.3517ms)
✔ actual PostgreSQL actions preserve request, approval, return and concurrency invariants (1339.4429ms)
✔ isolated PostgreSQL request RLS, approval immutability and rollback (711.7764ms)
✔ fresh database executes disbursement migration 0008, verifies RLS, grants, and immutability triggers idempotently (872.6379ms)
✔ NULL-email accounts log in by name/UUID and can add a unique email later (1213.796ms)
✔ role upgrade preserves accounts and user request permissions without granting inventory writes (285.0694ms)
ℹ tests 25 | pass 25 | fail 0 | cancelled 0 | skipped 0 | duration_ms 66904.5989
```

### 3.3 การตรวจสอบคุณภาพโค้ด (Quality Gates)
* **ESLint Verification (`npm run lint`):** ผ่าน (0 errors, 0 warnings)
* **TypeCheck Verification (`npm run typecheck`):** ผ่าน (0 errors)
* **Production Build (`npm run build`):** ผ่านสำเร็จ (Compiled 38 static/dynamic routes, Shared JS 441.43 KB / 450 KB, Performance budget check passed)

---

## 4. รายการไฟล์ที่มีการเปลี่ยนแปลง (Modified Files Summary)

| ไฟล์ที่แก้ไข | วัตถุประสงค์ของการแก้ไข |
| :--- | :--- |
| `.github/workflows/ci.yml` | ย้ายการติดตั้ง Playwright Chromium มาไว้ก่อน `npm test` ใน Job `build` และเพิ่ม Environment Variables พร้อมคำสั่งรัน Live Integration Tests 23 ไฟล์แบบครบถ้วนใน Job `postgres-release` |
| `features/disbursements/postgres-actions.ts` | ปรับปรุง Logic การจัดกลุ่มประเภทเอกสารในตะกร้าเบิก-ยืม ให้แยกวัสดุเป็น `material_issue` เสมอ และปฏิเสธการขอยืมวัสดุในคำขอเบิก |
| `features/disbursements/postgres-actions-live.test.ts` | ปรับ Regex การดักจับข้อผิดพลาดการยกเลิกเอกสารที่อนุมัติแล้วให้ตรงกับ Rule 0011, กำหนดวันที่ส่งคืนเป็นอนาคต, และตั้งค่า `is_central=true` สำหรับครุภัณฑ์ส่งมอบ |
| `tests/integration/acquisition-queries.test.ts` | เพิ่มคอลัมน์ `item_type` ในตารางชั่วคราว และปรับ Regex การแทนที่ตาราง `public.inventory_items` |
| `tests/integration/item-archive-live.test.ts` | ปรับ Regex ให้รองรับ Identifier ที่มีเครื่องหมายคำพูดคู่ `public."items"` จาก Drizzle ORM |
| `tests/integration/import-duplicate-feedback.test.ts` | Seed ข้อมูล Profile และ Item ตัวอย่างก่อนเริ่มทดสอบเพื่อตรวจจับ Collision ซ้ำอย่างแม่นยำ |
| `tests/integration/material-separation.test.ts` | เพิ่มขั้นตอนการรัน Migration 0006-0013 ต่อเนื่องหลังทดสอบ Migration 0005 |
| `tests/integration/category-types-migration.test.ts` | ให้ fallback ไปใช้ `DATABASE_MIGRATION_URL` จาก `.env.postgres.app` อัตโนมัติเมื่อไม่มี env variable ภายนอก |
| `tests/integration/postgres-disbursement-actions-live.test.ts` | แยกการ Insert วัสดุลง `materials` และครุภัณฑ์ลง `items`, ปรับแก้ Parameter Index ให้ถูกต้อง, และอัปเดต Assertion สต็อกตาม Rule 0009 |
| `tests/integration/postgres-disbursement-flow-live.test.ts` | แยกการ Insert ข้อมูลระหว่าง `materials` และ `items` และแก้ไขคำสั่งคิวรีสต็อกวัสดุให้ตรงกับตารางจริง |
| `tests/integration/postgres-disbursement-migration-live.test.ts` | ใส่ Approval Metadata (`confirmed_by`, `document_no`, `fiscal_year`) ครบถ้วนตามเงื่อนไขของ Trigger ป้องกันเอกสาร |

---

## 5. สรุปผลลัพธ์และข้อเสนอแนะ (Conclusion)

* ข้อผิดพลาด CI ทั้งหมดได้รับการแก้ไขจนสำเร็จลุล่วง
* ชุดการทดสอบ Integration และ Feature Live Tests ทั้งหมดรันผ่าน 100% บนฐานข้อมูลจริง โดยมี **0 failed tests** และ **0 unexpected skipped tests**
* ไม่มีการตัดทอน ปิดการทำงาน หรือลดระดับความเข้มงวดของการทดสอบเดิม
* ไม่มีการแก้ไขหรือแตะต้องข้อมูล Production และไม่มีการเปิดเผยข้อมูลความลับ (Secrets) ใดๆ
* ไม่มีการทำ `git commit` หรือ `git push` ตามข้อกำหนดของผู้ใช้อย่างเคร่งครัด
