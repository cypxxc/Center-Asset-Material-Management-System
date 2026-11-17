'use client'

import type { ChangeEventHandler, Ref } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Download, FileSpreadsheet } from 'lucide-react'
import { MATERIAL_IMPORT_COLUMNS } from '@/features/items/material-import-columns'

export function ImportUploadPanel({ type, busy, busyLabel = 'กำลังประมวลผลข้อมูล...', busyDescription, onDownload, onChange, inputRef }: {
 type: 'asset' | 'material'; busy: boolean; onDownload: () => void | Promise<void>;
 busyLabel?: string; busyDescription?: string;
 onChange: ChangeEventHandler<HTMLInputElement>; inputRef?: Ref<HTMLInputElement>;
}) {
 const noun = type === 'asset' ? 'ครุภัณฑ์' : 'วัสดุ'
 return (
 <div className="relative flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50">
  {busy ? <div role="status" aria-live="polite" className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
   <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" aria-hidden="true" />
   </div>
   <span className="text-sm font-semibold text-card-foreground">{busyLabel}</span>
   {busyDescription && <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">{busyDescription}</span>}
  </div> : <>
   <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-2xs"><FileSpreadsheet className="h-6 w-6" aria-hidden="true" /></div>
   <div className="space-y-1">
    <h4 className="text-sm font-bold text-card-foreground">เลือกไฟล์ Excel (.xlsx) เพื่อนำเข้า{noun}</h4>
    <p className="text-xs text-muted-foreground">ขนาดไฟล์ไม่เกิน 10MB ต่อไฟล์{type === 'material' ? ' · รองรับบัญชีวัสดุเดิมและเทมเพลต Excel ของระบบ · เลือกได้สูงสุด 4 ไฟล์' : ' และควรจัดรูปแบบคอลัมน์ให้ตรงตามเทมเพลต'}</p>
   </div>
   <div className="flex flex-wrap items-center justify-center gap-3">
    <button type="button" onClick={onDownload} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-card px-4 text-xs font-bold text-card-foreground shadow-2xs transition-all hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />ดาวน์โหลดเทมเพลต (Excel)</button>
    <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 focus-within:ring-2 focus-within:ring-ring">
     <Upload className="h-3.5 w-3.5" aria-hidden="true" /><span>เลือกไฟล์เพื่ออัปโหลด</span>
     <input ref={inputRef} id={type === 'material' ? 'material-ledger-files' : 'asset-import-file'} aria-label={type === 'material' ? 'เลือกไฟล์วัสดุ (Excel)' : 'เลือกไฟล์ครุภัณฑ์ (Excel)'} type="file" accept=".xlsx" multiple={type === 'material'} className="sr-only" onChange={onChange} />
    </label>
   </div>
  </>}
 </div>
 )
}

export function ImportResult({ success, message }: { success: boolean; message: string }) {
 return <div role={success ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-xl border p-4 ${success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>
  {success ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
  <div className="min-w-0 flex-1 space-y-1"><h5 className="text-xs font-bold">{success ? 'การนำเข้าสำเร็จ' : 'เกิดข้อผิดพลาดในการนำเข้า'}</h5><div className="max-h-60 overflow-y-auto whitespace-pre-line pr-2 font-mono text-[11px] font-normal leading-relaxed opacity-90">{message}</div></div>
 </div>
}

export function ImportFormatGuide({ type }: { type: 'asset' | 'material' }) {
 if (type === 'material') return <MaterialFormatGuide />
 return (
 <div className="rounded-xl border border-border p-6 bg-card space-y-3 shadow-2xs text-card-foreground">
 <div className="flex items-center gap-2 text-card-foreground">
 <FileText className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-bold">หัวตาราง Excel สำหรับนำเข้าครุภัณฑ์</h4>
 </div>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 อัปโหลดไฟล์ Excel .xlsx ได้โดยตรง สำหรับเทมเพลต Excel ที่ดาวน์โหลดจากระบบ แถวแรกใช้ชื่อคอลัมน์ภาษาอังกฤษตามตารางด้านล่าง:
 </p>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 ไฟล์ทะเบียน Excel เดิมจะอ่านสถานะตามเกณฑ์จากหัวข้อของแต่ละแผ่นงาน ส่วนเทมเพลตกลางให้ระบุ qualification_status สำหรับครุภัณฑ์
 </p>

 <div className="overflow-x-auto rounded-lg border border-border mt-2">
 <table className="table-data-uniform w-full text-left text-[11px] border-collapse bg-card">
 <thead>
 <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
 <th className="p-2 border-r border-border">หัวข้อคอลัมน์ (Header)</th>
 <th className="p-2 border-r border-border">ข้อมูลที่รองรับ</th>
 <th className="p-2">ตัวอย่างข้อมูล</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border text-card-foreground font-medium">
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">item_name</td>
 <td className="p-2 border-r border-border">ชื่อสิ่งของ/วัสดุครุภัณฑ์ (จำเป็น)</td>
 <td className="p-2">เครื่องคอมพิวเตอร์พกพา MacBook Air</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">item_type</td>
 <td className="p-2 border-r border-border">ประเภทสิ่งของ: asset (ครุภัณฑ์)</td>
 <td className="p-2">{type}</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">qualification_status</td>
 <td className="p-2 border-r border-border">สถานะตามเกณฑ์ครุภัณฑ์ (จำเป็นสำหรับ asset)</td>
 <td className="p-2">qualified หรือ below_threshold</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">quantity</td>
 <td className="p-2 border-r border-border">จำนวนวัสดุครุภัณฑ์ (ตัวเลขจำนวนเต็ม)</td>
 <td className="p-2">1</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">unit_price</td>
 <td className="p-2 border-r border-border">ราคาต่อหน่วย ใช้คำนวณมูลค่าในรายงาน (ไม่บังคับ)</td>
 <td className="p-2">35900</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">brand</td>
 <td className="p-2 border-r border-border">ยี่ห้อ/แบรนด์</td>
 <td className="p-2">Apple</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">model</td>
 <td className="p-2 border-r border-border">รุ่นสินค้า</td>
 <td className="p-2">M2 (2022)</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">asset_no</td>
 <td className="p-2 border-r border-border">รหัสเลขครุภัณฑ์ (เฉพาะครุภัณฑ์)</td>
 <td className="p-2">Portal-AS-9872</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">serial_no</td>
 <td className="p-2 border-r border-border">รหัสซีเรียลนัมเบอร์สินค้า (SN)</td>
 <td className="p-2">C02H20YQ088G</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">status</td>
 <td className="p-2 border-r border-border">สถานะ: active (ใช้งานได้) / damaged (ชำรุด) / inactive (เสื่อมสภาพ)</td>
 <td className="p-2">active</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 )
}

function MaterialFormatGuide() {
 return (
  <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xs">
   <div className="flex items-center gap-2">
    <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
    <h4 className="text-xs font-bold">หัวตาราง Excel สำหรับนำเข้าวัสดุ</h4>
   </div>
   <p className="text-[11px] leading-relaxed text-muted-foreground">อัปโหลดไฟล์ Excel .xlsx ได้โดยตรง สำหรับเพิ่มวัสดุใหม่ให้ดาวน์โหลดเทมเพลต Excel ของระบบ ตารางด้านล่างแสดงชื่อคอลัมน์ในเทมเพลต ระบุชื่อวัสดุและจำนวนคงเหลือเป็นอย่างน้อย ช่องอื่นเว้นว่างได้เมื่อไม่ทราบข้อมูล</p>
   <p className="text-[11px] leading-relaxed text-muted-foreground">รองรับบัญชีวัสดุรูปแบบเดิมทั้ง 4 ไฟล์ที่มีชีต รายการวัสดุ โดยอ่านหัวกลุ่มยอดคงเหลือยกมาและคงเหลือจากไฟล์โดยตรง ไฟล์ 1 เริ่มยอดยกมาที่ I ส่วนไฟล์ 2–4 มีสถานที่จัดเก็บแทรกที่ I จึงเริ่มยอดยกมาที่ J ไม่ต้องย้ายคอลัมน์ก่อนอัปโหลด</p>
   <p className="text-[11px] leading-relaxed text-muted-foreground">เทมเพลต Excel ใช้หัวตารางแถวเดียว โดยแยกจำนวนและจำนวนเงินของยอดยกมา รับ จ่าย และคงเหลือเป็นคนละคอลัมน์ ส่วนบัญชีเดิมให้อัปโหลดตามต้นฉบับโดยไม่ต้องแก้หัวตาราง ยอดยกมาต่างจากจำนวนคงเหลือปัจจุบัน</p>
   <div className="overflow-x-auto rounded-lg border border-border">
    <table className="table-data-uniform w-full border-collapse bg-card text-left text-[11px]">
     <thead><tr className="border-b border-border bg-muted/50 text-muted-foreground">
      <th scope="col" className="border-r border-border p-2">หัวข้อบัญชีวัสดุ / ข้อมูลที่รองรับ</th>
      <th scope="col" className="border-r border-border p-2">หัวคอลัมน์ในเทมเพลต Excel</th>
      <th scope="col" className="p-2">ตัวอย่างข้อมูล</th>
     </tr></thead>
     <tbody className="divide-y divide-border">
      {MATERIAL_IMPORT_COLUMNS.map(([key, label, example]) => <tr key={key} className="hover:bg-muted/40">
       <td className="border-r border-border p-2">{label}</td>
       <td className="border-r border-border p-2 font-mono font-semibold text-primary">{key}</td>
       <td className="p-2">{example}</td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </div>
 )
}
