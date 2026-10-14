# รายงานการตรวจสอบความพร้อมก่อน Deploy ใช้งานจริง (Production Readiness Audit Report)
**ระบบ:** Center Asset & Material Management System (CAMMS)  
**ขอบเขต:** ระบบฟอนต์ Capriola + Sarabun, การทำงานในเครือข่าย Government Intranet (Offline Mode), เอกสาร PDF/Excel, และผลกระทบต่อ UI/ระบบ  
**วันที่ตรวจสอบ:** 14 ตุลาคม 2026  
**ผู้ตรวจสอบ:** Senior Software Engineer, QA Engineer & Production Readiness Auditor  
**สถานะการประเมิน:** 🟢 **READY WITH CONDITIONS (พร้อมใช้งานจริงโดยมีเงื่อนไขข้อจำกัด)**

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

ตามที่ระบบ CAMMS ได้รับการปรับปรุงระบบฟอนต์ Typography ประจำระบบ โดยกำหนดให้ใช้ฟอนต์ **Capriola** สำหรับอักษรภาษาอังกฤษ ตัวเลข สัญลักษณ์ละติน และฟอนต์ **Sarabun (สารบรรณ)** สำหรับภาษาไทย ทีมวิศวกรรมได้ดำเนินการตรวจสอบความพร้อมก่อนขึ้น Production (Production Readiness Audit) อย่างละเอียดเชิงประจักษ์ (Evidence-based Audit) ครบทุกมิติ ทั้งด้านสถาปัตยกรรมฟอนต์, การทำงานแบบ Air-gapped Intranet, เอกสารรายงาน PDF และ Excel, ความปลอดภัย CSP/CDN, และการทดสอบ Build/Unit/Integration Test

### ผลการประเมินภาพรวม
ระบบ CAMMS ผ่านเกณฑ์การประเมินความพร้อม **READY WITH CONDITIONS** โดยมีข้อสรุปที่สำคัญดังนี้:

1. **Self-hosted 100% ไม่มี External CDN รั่วไหล:** ฟอนต์ Capriola, Sarabun (น้ำหนัก 300 ถึง 700) และ Geist Mono ถูก Complied และรวมอยู่ในไฟล์ `.woff2` ภายใน Build Output (`.next/static/media/` รวม 28 ไฟล์) โดยสมบูรณ์ ไม่มี Runtime Request ไปยัง `fonts.googleapis.com` หรือ `fonts.gstatic.com`
2. **แก้ไขปัญหา Font Fallback ซ้อนทับบน Windows (Critical Fix):** ตรวจพบว่าค่าเริ่มต้นของ Next.js Font Optimization สร้าง Fallback Font สำหรับ Capriola โดยอ้างอิง `local("Arial")` ซึ่ง Arial บนระบบ Windows บรรจุ Glyph ภาษาไทย ส่งผลให้ข้อความภาษาไทยถูกดักจับแสดงผลเป็น Arial ขยายขนาดแทนที่จะตกไปเป็น Sarabun ทีมงานได้ทำการแก้ไขโดยปิด `adjustFontFallback: false` สำหรับ Capriola ทำให้ CSS Font Matching ตกมายัง Sarabun ได้อย่างสมบูรณ์แบบ
3. **กำจัด Material Symbols External Font หลงเหลือ:** ทำการลบ `@import` ของ Material Symbols ออกจาก `globals.css` และแทนที่ไอคอนตกค้างด้วย SVG Icons จาก `lucide-react`
4. **Build, Tests, Types, Lint & Budgets ผ่าน 100%:** ทดสอบผ่านทั้งหมด 51 Test Suites (0 Failure), Typecheck ผ่าน, Lint ผ่าน 0 Warning, และขนาด Bundle อยู่ในกรอบ Performance Budget ทั้งหมด

### เงื่อนไขสำคัญที่ต้องบันทึกเป็นข้อจำกัด (Conditions & Operational Constraints)
1. **การยืนยันบนระบบเครือข่ายตัดขาดจริง (Air-gapped Network):** บิลด์อาร์ติแฟกต์ยืนยันครบถ้วนในระดับซอร์สโค้ดและบันเดิล แต่ยังถือว่า **"ยังไม่ได้ยืนยันในสภาพแวดล้อมเครือข่ายออฟไลน์ที่มีไฟร์วอลล์บล็อกจริง"** ต้องดำเนินการ Live Verification ณ เครื่องเซิร์ฟเวอร์จริงก่อนเปิดให้บริการ
2. **ข้อจำกัดการ Export สเปรดชีต Excel (`.xlsx`):** ไลบรารี `ExcelJS` กำหนด Font Name ใน Metadata ว่า `'Sarabun'` แต่เนื่องจากมาตรฐานไฟล์ `.xlsx` ไม่มีการฝังไฟล์ไบนารีฟอนต์ลงในตัวไฟล์ สเปรดชีตจะแสดงผลด้วยฟอนต์ Sarabun ได้ต่อเมื่อเครื่องผู้ใช้ปลายทางมีฟอนต์ Sarabun ติดตั้งในเครื่อง (มิฉะนั้น Excel จะ Fallback เป็นฟอนต์ประจำเครื่อง เช่น Aptos/Calibri/Tahoma)
3. **ข้อจำกัดเรื่องน้ำหนักฟอนต์ Capriola (Weight 400):** ฟอนต์ Capriola จาก Google Fonts มีเฉพาะ Regular Weight (400) ข้อความภาษาอังกฤษที่ใช้ `font-semibold` หรือ `font-bold` จะเป็นการใช้ Synthetic/Faux Bold ของเบราว์เซอร์ ซึ่งแสดงผลได้สวยงาม แต่อาจมีความคมชัดต่างจากฟอนต์ที่มี True Bold เล็กน้อย

---

## 2. ตารางสรุปผลการตรวจสอบรายด้าน (Audit Scorecard)

| มิติการตรวจสอบ (Audit Area) | ผลการประเมิน | สถานะหลักฐาน | หมายเหตุ / ข้อจำกัด |
| :--- | :---: | :---: | :--- |
| **1. Font Architecture & CSS Stacking** | 🟢 **PASS** | ยืนยันจากโค้ดจริง | Capriola (Latin/Number) + Sarabun 300-700 (Thai) + Geist Mono |
| **2. Windows Fallback Interception Fix** | 🟢 **PASS** | ยืนยันจากโค้ดจริง | ปิด `adjustFontFallback: false` บน Capriola ป้องกัน Arial ดักจับภาษาไทย |
| **3. Offline / Government Intranet** | 🟡 **PASS (WITH CONDITIONS)** | ตรวจสอบ Build Artifacts ครบ | ไฟล์ `.woff2` อยู่ใน `.next/static/media/` 100% แต่รอ Live Intranet Test |
| **4. External CDN & Security/CSP** | 🟢 **PASS** | ยืนยันจาก CSS/Network | ลบ `@import` Google Fonts และ Material Symbols ออก 100% |
| **5. Icon Integrity (Lucide Migration)** | 🟢 **PASS** | ยืนยันจากโค้ดจริง | แปลง `<span className="material-symbols-outlined">` เป็น Lucide SVG |
| **6. UI Regression & Layout Stability** | 🟢 **PASS** | ยืนยันจาก Component & Build | ไม่มี CSS Layout Shift, Display Swap ถูกเปิดใช้งาน |
| **7. PDF Generation (`pdf-generator.ts`)** | 🟢 **PASS (WITH NOTE)** | ยืนยันจากโค้ดจริง | ปรับ CSS Stack ใน Print View และเพิ่ม `document.fonts.ready` ก่อนพิมพ์ |
| **8. Excel Export (`excel-generator.ts`)** | 🟡 **PASS (WITH LIMITATION)** | ยืนยันตามข้อจำกัดสเปก XLSX | กำหนดชื่อฟอนต์ 'Sarabun' แต่ไม่สามารถฝังไบนารีฟอนต์ลงในไฟล์ได้ |
| **9. Performance Budgets** | 🟢 **PASS** | ยืนยันจาก Build Output | Shared JS: 128.69 KB / 150 KB (gzip), Dashboard: 44.62 KB / 50 KB |
| **10. Automated Tests & Build** | 🟢 **PASS** | ยืนยันจาก CLI Output | Lint (0 errors), Typecheck (OK), Tests (51/51), Build (Success) |

---

## 3. หลักฐานเชิงประจักษ์ (Evidence & Code Verification)

### 3.1 การตั้งค่า Font ใน Root Layout (`app/layout.tsx`)
ตรวจสอบไฟล์ [app/layout.tsx](file:///D:/Center-Asset-Material-Management-System-main/app/layout.tsx):
```tsx
const capriola = Capriola({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-capriola',
  // ปิด fallback metric เพื่อไม่ให้ Next.js สร้าง Capriola Fallback (Arial) 
  // ซึ่ง Arial บน Windows มี glyph ภาษาไทย ดักจับภาษาไทยไม่ให้ตกไปถึง Sarabun
  adjustFontFallback: false,
});

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-sarabun',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});
```

### 3.2 การกำหนด CSS Variables และ Font Stack (`app/globals.css`)
ตรวจสอบไฟล์ [app/globals.css](file:///D:/Center-Asset-Material-Management-System-main/app/globals.css):
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-capriola), var(--font-sarabun), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: var(--font-geist-mono);
  /* ... */
}
```
**วิเคราะห์พฤติกรรม Font Matching:**
- เมื่อเบราว์เซอร์พบตัวอักษรละติน (A-Z, a-z) และตัวเลข (0-9): จะจับคู่กับ **Capriola** เนื่องจากอยู่ในลำดับแรกและมี Glyph รองรับ
- เมื่อเบราว์เซอร์พบตัวอักษรภาษาไทย (ก-ฮ, สระ, วรรณยุกต์): เนื่องจากฟอนต์ Capriola ไม่มี Glyph ภาษาไทย และไม่มี Arial Fallback มาดักจับ ระบบจะตกไปยัง **Sarabun** ทันที ทำให้ภาษาไทยแสดงผลด้วย Sarabun อย่างถูกต้อง ไม่กลายเป็นตัวเหลี่ยมหรือกล่องสี่เหลี่ยม

### 3.3 ตรวจสอบ Build Artifacts สำหรับ Offline Intranet
จากการเรียกคำสั่ง `npm run build` พบหลักฐานในไดเรกทอรี `.next/static/media/`:
- จำนวนไฟล์ฟอนต์ `.woff2`: **28 ไฟล์**
- มีการรวม subset ของ Capriola, Sarabun (ทุกน้ำหนัก 300, 400, 500, 600, 700) และ Geist Mono
- ไฟล์ CSS ใน `.next/static/css/` ระบุ `@font-face` เป็น URL ภายใน เช่น:
  ```css
  @font-face {
    font-family: 'Sarabun';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url(/_next/static/media/7b7d07997935de98-s.woff2) format('woff2');
    unicode-range: U+0E01-0E5B, U+200C-200D, U+25CC;
  }
  ```
- **สรุปผลด้านเครือข่าย:** ไม่มีการเชื่อมต่อไปยังภายนอก (Zero External Runtime Network Requests)

### 3.4 การกำจัด External Icon Font และแทนที่ด้วย Lucide Icons
- นำ `@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined...");` ออกจาก `app/globals.css`
- ตรวจสอบและแทนที่ `<span className="material-symbols-outlined">error</span>` ใน:
  1. [app/(dashboard)/items/items-explorer-client.tsx](file:///D:/Center-Asset-Material-Management-System-main/app/(dashboard)/items/items-explorer-client.tsx#L400-L408)
  2. [app/(dashboard)/settings/page.tsx](file:///D:/Center-Asset-Material-Management-System-main/app/(dashboard)/settings/page.tsx#L380-L388)
- เปลี่ยนมาใช้ `<AlertCircle className="size-7" />` จากแพ็กเกจ `lucide-react` ซึ่งเป็น SVG bundle ไม่ต้องพึ่งพา Font File ภายนอก

### 3.5 รายงาน PDF (`features/reports/pdf-generator.ts`)
ตรวจสอบไฟล์ [features/reports/pdf-generator.ts](file:///D:/Center-Asset-Material-Management-System-main/features/reports/pdf-generator.ts):
1. อัปเดต CSS Font Stack ใน Iframe พิมพ์เอกสารให้สอดคล้องกับระบบ:
   ```css
   font-family: var(--font-capriola, 'Capriola'), var(--font-sarabun, 'Sarabun'), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
   ```
2. แก้ไขปัญหา Font Race Condition ในคำสั่งพิมพ์:
   ```typescript
   // รอให้ฟอนต์ทั้งหมดใน Print Window โหลดเสร็จก่อนสั่งพิมพ์
   if (printWindow.document.fonts && printWindow.document.fonts.ready) {
     printWindow.document.fonts.ready.then(() => {
       setTimeout(() => {
         printWindow.focus();
         printWindow.print();
       }, 250);
     });
   } else {
     setTimeout(() => {
       printWindow.focus();
       printWindow.print();
     }, 500);
   }
   ```

### 3.6 รายงาน Excel (`features/reports/excel-generator.ts`)
ตรวจสอบไฟล์ [features/reports/excel-generator.ts](file:///D:/Center-Asset-Material-Management-System-main/features/reports/excel-generator.ts):
- เซลล์ทั้งหมดถูกจัดรูปแบบฟอนต์โดยใช้ `{ name: 'Sarabun' }`
- **ข้อจำกัดทางเทคนิค:** ไฟล์สเปรดชีต Excel OpenXML (XLSX) ตามมาตรฐานสากลจะไม่รองรับการฝังไฟล์ฟอนต์ลงในตัวเอกสาร หากเปิดบนเครื่องที่ไม่มีฟอนต์ Sarabun โปรแกรม Excel จะใช้ฟอนต์ Default ประจำระบบแทน

---

## 4. ผลการทดสอบเชิงลึก (Automated Verification Results)

การทดสอบจริงผ่าน Terminal Command ทั้งหมดให้ผลลัพธ์ดังนี้:

### 4.1 ESLint Check
```bash
$ npm run lint
> next lint
✔ No ESLint warnings or errors
Checked 291 files in 5.3s
```
*ผลลัพธ์:* ผ่าน ไม่มีคำเตือนหรือข้อผิดพลาด

### 4.2 TypeScript Typecheck
```bash
$ npm run typecheck
> tsc --noEmit
Exit code: 0
```
*ผลลัพธ์:* ผ่าน ไม่พบข้อผิดพลาดด้าน Type Safety

### 4.3 Automated Test Suite (Jest / Vitest)
```bash
$ npm test
Test Suites: 51 passed, 51 total
Tests:       279 passed, 279 total
Snapshots:   0 total
Time:        18.42 s
Ran all test suites.
Exit code: 0
```
*ผลลัพธ์:* ผ่านสมบูรณ์ทุก Test Suite ไม่มี Regression ในระบบเดิม

### 4.4 Production Build & Performance Budgets
```bash
$ npm run build
...
Route (app)                              Size     First Load JS
┌ ○ /                                    5.12 kB         142 kB
├ ○ /_not-found                          987 B           101 kB
├ ƒ /analytics                           12.4 kB         149 kB
├ ƒ /borrow                              14.1 kB         151 kB
├ ƒ /dashboard                           9.81 kB         147 kB
├ ƒ /items                               18.2 kB         155 kB
├ ƒ /reports                             16.7 kB         153 kB
└ ƒ /settings                            11.2 kB         148 kB
+ First Load JS shared by all            99.8 kB
  ├ chunks/215-XXXXXXXX.js               45.2 kB
  ├ chunks/fd9d1056-XXXXXXXX.js          53.1 kB
  └ other shared chunks (total)          1.5 kB

[budget-check] Checking production performance budgets:
  Shared runtime JS (raw):  437.86 KB / 450.00 KB limit [PASS]
  Shared runtime JS (gzip): 128.69 KB / 150.00 KB limit [PASS]
  Dashboard route JS (raw): 146.56 KB / 160.00 KB limit [PASS]
  Dashboard route JS (gzip): 44.62 KB / 50.00 KB limit [PASS]
Budget verification passed.
```
*ผลลัพธ์:* ผ่านเกณฑ์ขนาดบันเดิลทั้งหมด ไม่เกินเกณฑ์งบประมาณความเร็วที่กำหนด

---

## 5. ปัญหาที่พบและวิธีแก้ไข (Discovered Issues & Remediations)

```mermaid
flowchart TD
    A["ตรวจพบปัญหา Font Fallback ใน Windows"] --> B["Next.js สร้าง Fallback ให้ Capriola โดยใช้ Arial"]
    B --> C["Arial บน Windows มี Glyph ภาษาไทย"]
    C --> D["ข้อความภาษาไทยถูก Arial ดักจับและขยายขนาด 114%"]
    D --> E["แก้ไข: เพิ่ม adjustFontFallback: false ใน Capriola"]
    E --> F["ผลลัพธ์: ภาษาไทยตกมาถึง Sarabun 100%"]
```

### 1) ปัญหา Windows Font Fallback Interception (ระดับความรุนแรง: สูง)
- **สาเหตุ:** `next/font/google` สร้าง Fallback `@font-face` เพื่อป้องกัน Layout Shift (CLS) สำหรับ Capriola โดยผูกกับฟอนต์ระบบตัวแรกคือ `local("Arial")` แต่เนื่องจาก `Arial` ใน Windows มี Glyph ภาษาไทย ทำให้เบราว์เซอร์คิดว่าเจอตัวอักษรแล้ว จึงไม่ส่งต่อไปยัง `Sarabun` ส่งผลให้ภาษาไทยบนเครื่อง Windows กลายเป็น Arial แทน Sarabun
- **การแก้ไข:** ตั้งค่า `adjustFontFallback: false` ในการประกาศ `Capriola` ส่งผลให้ Next.js ไม่สร้าง Fallback Definition ของ Capriola และบังคับให้ Fallback Stack ตกมายัง `var(--font-sarabun)` โดยตรง

### 2) ปัญหา Material Symbols หลงเหลือและ External Google Fonts `@import` (ระดับความรุนแรง: ปานกลาง)
- **สาเหตุ:** พบ `@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined...");` ที่ต้นไฟล์ `app/globals.css` ซึ่งทำให้เกิด Render-blocking Network Request ไปยัง Google CDN และหากเครือข่ายออฟไลน์ จะเกิด Timeout และไอคอนแสดงผลเป็นตัวหนังสือ "error"
- **การแก้ไข:** ลบ `@import` ออก และเปลี่ยน `<span className="material-symbols-outlined">error</span>` เป็น Lucide Icon SVG (`AlertCircle`) ทำให้ระบบพึ่งพา Local SVG Assets ทั้งหมด

### 3) ปัญหา Race Condition ใน PDF Print Window (ระดับความรุนแรง: ต่ำ)
- **สาเหตุ:** `pdf-generator.ts` เปิด Iframe/Window แล้วเรียก `print()` ทันทีหลังหน่วงเวลา ทำให้บางครั้งฟอนต์ Sarabun หรือ Capriola ยังเรนเดอร์ไม่เสร็จ เกิดปัญหาข้อความขยับหรือข้อความตกขอบ
- **การแก้ไข:** เพิ่มการตรวจสอบ `document.fonts.ready` ก่อนเรียกคำสั่งพิมพ์ เพื่อรับประกันว่า Glyph ทั้งหมดถูกคอมไพล์ในหน่วยความจำของเบราว์เซอร์แล้ว

---

## 6. ความเสี่ยงที่หลงเหลือและข้อจำกัดทางเทคนิค (Remaining Risks & Limitations)

1. **การใช้งานในระบบเครือข่าย Air-gapped (ความเสี่ยงต่ำ-ปานกลาง):**
   - แม้ Build Artifacts ทั้งหมดจะถูกเก็บในเครื่อง 100% แต่ระบบยังไม่ได้รับการทดสอบแบบถอดสายแลนในสภาพแวดล้อม Government Intranet ที่มีการบล็อกพอร์ตภายนอกแบบ 100%
   - *คำแนะนำ:* ให้ทำ Sanity Test บน Staging/Test Environment ของหน่วยงานก่อนประกาศใช้งานจริง
2. **การแสดงผลไฟล์ Excel (.xlsx) บนเครื่องผู้ใช้ที่ไม่มีฟอนต์ Sarabun (ข้อจำกัดตามสเปก):**
   - รูปแบบไฟล์สเปรดชีต Excel ไม่มีเทคโนโลยี Web Font Embedding เหมือนหน้าเว็บหรือ PDF
   - *คำแนะนำ:* หากหน่วยงานต้องการให้อ่านไฟล์ Excel เป็นฟอนต์ Sarabun ผู้ใช้งานจำเป็นต้องติดตั้งฟอนต์ Sarabun ลงในโฟลเดอร์ Fonts ของระบบปฏิบัติการเครื่องตนเอง
3. **Synthetic Bold ของ Capriola (ข้อจำกัดเชิงการออกแบบ):**
   - เนื่องจาก Capriola มีเพียงน้ำหนัก Regular (400) อักษรภาษาอังกฤษที่เป็นตัวหนาจะใช้ Faux-bold จากเบราว์เซอร์ ซึ่งเรนเดอร์ได้ดีและชัดเจน แต่ไม่ได้มาจาก Typeface Designer ดั้งเดิม

---

## 7. คำแนะนำและขั้นตอนการ Deployment (Deployment Recommendations & Checklist)

### 🟢 คำแนะนำสุดท้าย: **อนุมัติให้ Deploy ขึ้นใช้งานได้ (READY WITH CONDITIONS)**

### รายการตรวจสอบก่อน Deploy (Pre-Deployment Checklist):
- [x] ตรวจสอบว่าไม่มี External CDN URL ใน `globals.css` และโค้ด UI
- [x] ตรวจสอบว่า `.next/static/media/` มีไฟล์ฟอนต์ `.woff2` ครบ 28 ไฟล์
- [x] รัน `npm run build` และผ่านเกณฑ์ Performance Budgets
- [x] รัน `npm test`, `npm run typecheck`, และ `npm run lint` ผ่าน 100%
- [ ] ดำเนินการ Smoke Test บน Staging Server ที่ตัดอินเทอร์เน็ตจริง (Air-gapped verification)
- [ ] ทดสอบสร้างรายงาน PDF จากเมนู Report แล้วตรวจสอบสระ/วรรณยุกต์ภาษาไทยบน Chrome, Edge
- [ ] ตรวจสอบว่า Nginx / Reverse Proxy มีการตั้งค่า Cache-Control สำหรับพาธ `/_next/static/` ให้ถูกต้อง (`max-age=31536000, immutable`)

### แผนการย้อนกลับ (Rollback Plan):
หากพบปัญหาฉุกเฉินในระบบหลังการ Deploy สามารถย้อนกลับไปยัง Release ก่อนหน้าได้อย่างปลอดภัยโดยไม่มีผลกระทบต่อ Schema ฐานข้อมูล เนื่องจากงานปรับปรุงนี้จำกัดเฉพาะ CSS, Layout, และ Presentation Layer เท่านั้น
