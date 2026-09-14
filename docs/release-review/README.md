# ผลตรวจความพร้อม Production — 14 กันยายน 2026

**สถานะหลังแก้ไข: ข้อผิดพลาดของโปรแกรมได้รับการแก้และผ่านการทดสอบ production บน Docker ในเครื่องแล้ว แต่ยังไม่อนุมัติเปิดบริการจริงจนกว่าจะกำหนด endpoint/ใบรับรองที่เครื่องผู้ใช้เชื่อถือ และเปิดใช้ backup นอกเครื่องตามบัญชีงานที่เลือก**

## ผลแก้ไขและตรวจซ้ำ

- ชุดทดสอบรวมรอบสุดท้ายผ่าน **464 ข้อใน 113 ไฟล์**, fail 0, ข้าม 3 opt-in tests ซึ่งเปิดใช้และตรวจผ่านแยกแล้ว; build/typecheck/lint ผ่าน และ dependency audit ไม่พบช่องโหว่ที่รายงาน ณ เวลาตรวจ หลักฐาน `.cache/postgres/release-final-tests.log`

- แก้เพดาน Server Actions และ proxy ให้รองรับ JSON backup 25 MiB พร้อม overhead จากการเข้ารหัส คงขนาดไฟล์ธุรกิจ 25 MiB และ CSV/ภาพ 5 MiB; ตรวจ UTF-8 เป็นจำนวน bytes
- ทดสอบจริงทั้ง host และ HTTPS Docker: 1.2 MB และ 25 MiB ผ่าน transport, ข้อมูลเกินขนาดถูกปฏิเสธด้วยข้อความจากระบบ; ทดสอบหน้า upload กับไฟล์ไม่ถูกต้อง/ใหญ่เกินขนาด/เครือข่ายล้มเหลวแล้วปุ่มกลับมาใช้งานได้
- พบสาเหตุแก้จำนวนผิด: visible input รับการแก้ก่อน hydration แต่ hidden input ยังส่งค่าเดิม แก้ให้ช่องตัวเลขพร้อมรับค่าหลัง handlers พร้อม; regression จำลองโหลด JavaScript ช้า และแก้จำนวนต่อเนื่อง 5 ครั้งผ่านทั้ง host และ Docker HTTPS
- เพิ่ม CI job `postgres-release` ที่สร้างฐานข้อมูลจริง ติดตั้งซ้ำ ทดสอบ RLS/session/query/admin/browser/HTTP/limits/full recovery และ build image; workflow ถูกตรวจในเครื่อง แต่ยังไม่ได้ push หรืออ้างว่า GitHub Actions รันแล้ว
- สร้างและเปิด Docker app + Caddy ที่ `https://localhost:8443` แบบ loopback โดยใช้ฐานข้อมูล/รูปภาพเดิม; image nonroot, read-only root, runtime secrets แยก, log rotation, health checks, restart policy
- ตรวจความถูกต้อง TLS ด้วย CA ที่ระบุเฉพาะกระบวนการทดสอบ ไม่ติดตั้ง CA ลง trust store ของ Windows; Chromium ใช้บริบททดสอบหลัง Node ตรวจ certificate chain สำเร็จ
- ทดลองหยุด process เว็บจริง: Docker restart count เพิ่มเป็น 1, service กลับมา healthy, HTTPS readiness 200 จากนั้นทดสอบ import UI ผ่าน
- เปิด Docker Desktop AutoStart และรายการเริ่มหลังล็อกอิน Windows ของบัญชีปัจจุบันแล้ว โดยสำรองค่าเดิมใน `.cache/postgres/docker-autostart-before.json`; ไม่ได้รีบูตเครื่อง และยังต้องมีการล็อกอินให้ Docker Desktop engine เริ่มทำงาน
- Full recovery drill ผ่าน: pg_dump/pg_restore, เทียบข้อมูลครบ 10 ตาราง, ตรวจ SHA-256 รูปภาพ, รหัสผ่านใช้ได้, ล้าง restored sessions, เปิดเว็บอีกพอร์ต ล็อกอินและอ่านรูปที่กู้คืนจริง; ล้างเฉพาะฐานข้อมูล/ไฟล์ชั่วคราว
- Load ผ่าน HTTPS Docker: 20 clients + 20 SSE streams, fixture 1,000 items, 200 requests, errors 0, p95 943 ms, p99 1,020 ms; เป็น bounded read workload ไม่ใช่การรับรองโหลดทุกชนิดหรือทุกขนาดข้อมูล
- เพิ่ม backup runner/Windows task installer พร้อมป้องกันงานซ้อน retry/timeout/status; ทดลอง runner สำรองจริงในเครื่องผ่าน งานรายวันยังไม่ลงทะเบียนเพราะยังไม่มีปลายทางนอกเครื่องและบัญชีที่เข้าถึงปลายทางนั้น
- ข้อมูลธุรกิจเดิมถูกเก็บไว้; หลังล้าง fixture พบ profiles 2 บัญชีเดิม, items/categories/units/locations 0 รายการ ไม่ลบบัญชีที่มีอยู่ก่อนการทดสอบ

### สิ่งที่ต้องระบุเพื่อเปิดบริการจริง

1. ชื่อโดเมนหรือ IP/เครือข่ายผู้ใช้งาน เพื่อกำหนด bind, DNS และใบรับรอง HTTPS ที่เครื่องผู้ใช้เชื่อถือ ปัจจุบันเป็น local CA สำหรับการทดสอบ
2. ปลายทาง backup นอกเครื่อง เช่น UNC ของ NAS และบัญชี Windows ที่เข้าถึง Docker/โครงการ/ปลายทางได้ ให้กรอก password ผ่าน Windows credential prompt ของ installer ไม่ส่งในแชต
3. หากต้องทำงานหลังเปิดเครื่องโดยไม่มีใครล็อกอิน ต้องใช้ host ที่รองรับบริการต่อเนื่องหรือจัดการ boot service และทดสอบรีบูตจริง; Docker Desktop login startup ไม่ใช่ unattended server boot

คู่มือ: [deployment](../production/README.md), [scheduled backup](../production/backup-README.md), [PostgreSQL](../postgres/README.md)

หลักฐานใหม่: `.cache/postgres/production-final-build.log`, `docker-final-build.log`, `load-result.json`, `browser-edit-diagnostics.json`, `.cache/postgres-backup-job/status.json` และผลคำสั่งตรวจใน task นี้

---

## บันทึกก่อนแก้ไข (เก็บเพื่อเปรียบเทียบ)

ตรวจโค้ดและระบบ PostgreSQL + Drizzle บน Docker Desktop ที่ 127.0.0.1:3000 ใหม่ในรอบนี้ ไม่ได้แก้โค้ดแอประหว่างการตรวจ และไม่ได้เผยแพร่ระบบออกภายนอก

## สิ่งที่ต้องปิดก่อน release

1. **ยืนยันแล้ว: คำขอนำเข้าขนาดเกิน 1 MB ล้มเหลวก่อนถึง validation ของระบบ** — `next.config.ts` ไม่ตั้ง `experimental.serverActions.bodySizeLimit`; Next ที่ติดตั้งใช้ค่าเริ่มต้น 1 MB ขณะที่ส่วนพัสดุตรวจรับ 5 MB และส่วน backup รับขนาดใหญ่กว่านี้ ทดสอบผ่าน browser session ของ admin ไปยัง Server Action `importDatabaseData` ด้วย JSON ที่จงใจไม่ถูกต้องเพื่อไม่ให้เปลี่ยนข้อมูล: 100 bytes ได้ validation error ตามปกติ; 1,200,000 bytes ได้ HTTP 500 และ log `Body exceeded 1 MB limit` / statusCode 413 ต้องกำหนดขนาดให้สอดคล้องพร้อมเผื่อ multipart overhead และทดสอบขอบเขตขนาดผ่าน UI จริง
2. **ยังหาสาเหตุไม่ได้: ทดสอบแก้ไขพัสดุผ่าน browser ไม่ผ่านสม่ำเสมอ** — รอบแรกสร้างรายการแล้วแก้จำนวนจาก 2 เป็น 3 แต่ query ยังได้ 2 จนครบ timeout 5 วินาที รอบที่สองผ่านโดยไม่ได้แก้โค้ด ยังสรุปไม่ได้ว่าเกิดจากระบบ การโหลดหน้า หรือจังหวะการทดสอบ ต้องเก็บ request/response และสถานะฟอร์มในรอบที่ล้มเหลวก่อนปิดประเด็น
3. **CI/release ยังไม่ครอบคลุม PostgreSQL จริง** — `.github/workflows/ci.yml` ทั้ง build และ staging-release ตั้งค่า Supabase; ไม่มี PostgreSQL service/migrations/live integration tests ใน pipeline ต้องเพิ่ม gate สำหรับ backend ที่จะปล่อยจริง
4. **การติดตั้งปัจจุบันเป็นเครื่อง local** — เว็บ bind เฉพาะ 127.0.0.1:3000 ผ่าน HTTP ฐานข้อมูลมี restart policy แต่เว็บรันด้วย Start-Process ไม่พบ Windows service/scheduled task ชื่อ CAMMS ที่รองรับการเริ่มเว็บเอง ต้องเตรียม endpoint/HTTPS และการเริ่มบริการอัตโนมัติพร้อมตรวจหลังรีสตาร์ต ก่อนเปิดให้ผู้ใช้งานจริง
5. **การกู้คืนทั้งชุดและการรองรับโหลด ยังไม่ผ่านการพิสูจน์ครบวงจร** — live test ที่ผ่านคือ JSON restore ข้อมูลธุรกิจในฐานข้อมูลชั่วคราว ไม่ใช่ pg_restore ของ full backup รวมรูปภาพแล้วเปิดเว็บล็อกอินใหม่ หลักฐานเดิมของ full backup เป็นการสร้าง archive และอ่านรายการภายใน ต้องซ้อมกู้คืนทั้งชุด เตรียม backup นอกเครื่อง/กำหนดรอบและระยะเก็บ และทดสอบตามจำนวนผู้ใช้งานเป้าหมาย

## ผลที่ผ่านในรอบนี้

- `npm test`: 110 ไฟล์, ผ่าน 451 ข้อ, ไม่ผ่าน 0, ข้าม 3 ข้อที่ต้องเปิด integration environment
- `npm run lint`, `npm run typecheck`, `npm run build` ผ่าน รวมงบ JavaScript
- `verify-env`, `verify-db-release`, `audit:security` ผ่าน
- `npm audit --audit-level=low`: ไม่พบช่องโหว่ที่รายงานใน dependencies ณ เวลาตรวจ
- Docker PostgreSQL healthy; จำกัดการเปิดพอร์ตบน loopback
- Browser: หน้าหลักทั้ง 9 หน้าเข้าได้; รอบที่สอง CRUD และ logout ผ่าน; รอบแรกยังมีความไม่แน่นอนตามรายการข้างต้น
- HTTP จริง: สิทธิ์อ่านรูป, ป้องกัน traversal, SSE commit/rollback และยกเลิก session ผ่าน; stream ถูกปิดในประมาณ 13.7 วินาที
- Security จริง: restricted roles/RLS, viewer/staff permissions, ป้องกันยกระดับสิทธิ์, password/session validation และ concurrent password reset ผ่าน
- Live integration เปิดใช้แยกและผ่าน 3 ข้อ: queries, admin/account/session, fresh migration + atomic business restore (รวม rollback)
- สร้าง production build ใหม่และเปิดเว็บกลับที่พอร์ตเดิมแล้ว

## หลักฐานในเครื่อง

- `.cache/postgres/recheck-tests.log`
- `.cache/postgres/recheck-build.log`
- `.cache/postgres/recheck-production.log`
- `.cache/postgres/recheck-production-error.log` (มี error ที่ตั้งใจทำซ้ำเพื่อยืนยัน body limit)
- `.cache/postgres/recheck-body-limit.ts` (diagnostic เท่านั้น ใช้ input ไม่ถูกต้องและไม่กู้คืนข้อมูลใด)

ผลผ่านเหล่านี้ไม่ใช่การรับรองว่าไม่มีข้อผิดพลาดทั้งหมด การรายงานก่อนหน้านี้ว่า “เสร็จแล้ว” หมายถึงการเปลี่ยน backend และตรวจการทำงานพื้นฐาน ไม่ควรใช้แทนการอนุมัติ production release
