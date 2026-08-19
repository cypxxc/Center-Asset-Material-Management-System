'use client'

import {
  AlertTriangle,
  BookOpen,
  Database,
  FileText,
  Package,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react'

export function HeaderGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm md:text-base font-bold text-slate-800">
            <BookOpen className="h-5 w-5 text-blue-600" />
            คู่มือการใช้งานระบบทะเบียนสิ่งของ (CAMMS User Guide)
          </h2>
          <button
            onClick={onClose}
            aria-label="ปิดคู่มือการใช้งาน"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors cursor-pointer"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
    
        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-8 scrollbar-thin text-slate-700 text-xs md:text-sm leading-relaxed">
          {/* Introduction */}
          <div className="space-y-2">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wide">ภาพรวมระบบ</h3>
            <p className="text-[11px] md:text-xs text-slate-500">
              CAMMS Portal (Center Asset & Material Management System) — ระบบบริหารจัดการพัสดุและสินทรัพย์ส่วนกลาง เป็นระบบสำหรับลงทะเบียน ตรวจสอบ และบริหารจัดการทะเบียนพัสดุ วัสดุสิ้นเปลือง และครุภัณฑ์ภายในสำนักงานอย่างมีประสิทธิภาพ
            </p>
          </div>
    
          {/* Roles & Permissions Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              บทบาทผู้ใช้งานและสิทธิ์ในระบบ (Roles & Permissions)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse text-[10px] md:text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-2.5">ฟังก์ชันการใช้งาน</th>
                    <th className="p-2.5 text-center">Admin</th>
                    <th className="p-2.5 text-center">Staff</th>
                    <th className="p-2.5 text-center">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">ดูแดชบอร์ดและรายการสิ่งของทั้งหมด</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">พิมพ์รายงานและส่งออกข้อมูลเป็น Excel/PDF</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">ขึ้นทะเบียนใหม่ และแก้ไขข้อมูลพัสดุ</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">ลบรายการออกจากมุมมองหลักชั่วคราว</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">จัดการรายการที่ลบและกู้คืนข้อมูล</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">ลบรายการออกจากฐานข้อมูลอย่างถาวร</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">จัดการข้อมูลพื้นฐานของระบบ (ประเภท/หมวดหมู่/สถานที่)</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2.5">ใช้งานแผงควบคุมฐานข้อมูลสำหรับผู้ดูแลระบบ</td>
                    <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                    <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
    
          {/* Login & Profile */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <User className="h-4 w-4 text-blue-600" />
              การเข้าสู่ระบบและจัดการโปรไฟล์ (Login & Profile)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] md:text-xs text-slate-600">
              <li><strong>การเข้าสู่ระบบ:</strong> กรอกรหัสผู้ใช้หรืออีเมล และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ หากบัญชีถูกระงับการใช้งาน ระบบจะไม่อนุญาตให้เข้าสู่ระบบ</li>
              <li><strong>แก้ไขโปรไฟล์ส่วนตัว:</strong> ไปที่เมนูโปรไฟล์เพื่อปรับปรุงชื่อ-นามสกุล และเปลี่ยนรหัสผ่านส่วนตัว (รหัสผ่านอย่างน้อย 6 ตัวอักษร)</li>
            </ul>
          </div>
    
          {/* Item Explorer */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Package className="h-4 w-4 text-blue-600" />
              การจัดการรายการพัสดุและครุภัณฑ์ (Item Management)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] md:text-xs text-slate-600">
              <li><strong>การค้นหา:</strong> ค้นหาด้วยชื่อ เลขครุภัณฑ์ หมายเลขซีเรียล ยี่ห้อ รุ่น หรือผู้รับผิดชอบผ่านช่องค้นหา</li>
              <li><strong>การกรองข้อมูล:</strong> คัดกรองตามหมวดหมู่ สถานที่ตั้งจัดเก็บ หรือสถานะการใช้งาน</li>
              <li><strong>ขึ้นทะเบียนใหม่:</strong> เลือกประเภทสิ่งของ (วัสดุสิ้นเปลือง / ครุภัณฑ์) กรอกรายละเอียด และสามารถอัปโหลดรูปภาพเพื่อประกอบทะเบียนสิ่งของได้</li>
              <li><strong>การดำเนินการหลายรายการ:</strong> เลือกรายการหลายรายการเพื่อแก้ไขสถานที่จัดเก็บหรือสถานะพร้อมกันได้</li>
            </ul>
          </div>
    
          {/* Trash & Recovery */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              ระบบถังขยะและการกู้คืนข้อมูล (Trash & Recovery)
            </h3>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] md:text-xs text-amber-900 space-y-2">
              <p><strong>การลบชั่วคราว:</strong> เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถนำรายการไปยังถังขยะได้ รายการจะยังสามารถกู้คืนได้</p>
              <p><strong>การกู้คืนรายการ:</strong> ผู้ดูแลระบบและเจ้าหน้าที่สามารถกู้คืนรายการจากถังขยะกลับเข้าสู่ระบบได้</p>
              <p><strong>การลบถาวร:</strong> เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบรายการออกจากฐานข้อมูลและพื้นที่จัดเก็บรูปภาพอย่างถาวรได้</p>
            </div>
          </div>
    
          {/* Reports & Exports */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              การสรุปรายงานและการส่งออก (Reports & Export)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] md:text-xs text-slate-600">
              <li><strong>รายงาน Excel (XLSX):</strong> ส่งออกรายการสิ่งของทั้งหมดหรือชุดที่ทำการกรองค้นหา ออกเป็นตารางชีต Excel จัดการหน้าสวยงามพร้อมจัดเก็บทันที</li>
              <li><strong>พิมพ์ PDF:</strong> พิมพ์รายงานเป็นไฟล์เอกสาร PDF ในรูปแบบแนวนอน A4 พร้อมสั่งพิมพ์ทางเครื่องพิมพ์ได้โดยตรง</li>
            </ul>
          </div>
    
          {/* Metadata Settings */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Settings className="h-4 w-4 text-blue-600" />
              การตั้งค่าข้อมูลโครงสร้างหลัก (Metadata - เฉพาะผู้ดูแลระบบ)
            </h3>
            <p className="text-[11px] md:text-xs text-slate-600">
              ใช้สำหรับจัดการข้อมูลหมวดหมู่ (Categories), สถานที่ตั้ง (Locations) และหน่วยนับ (Units) เพื่อใช้ระบุสิ่งของในฟอร์มลงทะเบียน โดยระบบจะไม่อนุญาตให้ปิดใช้งานหรือลบข้อมูลเหล่านี้หากยังมีพัสดุเรียกใช้งานอยู่ เพื่อความถูกต้องปลอดภัยของฐานข้อมูล
            </p>
          </div>
    
          {/* DB Admin Panel */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Database className="h-4 w-4 text-blue-600" />
              แผงควบคุมฐานข้อมูลระดับสูง (DB Admin Panel - เฉพาะผู้ดูแลระบบ)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] md:text-xs text-slate-600">
              <li><strong>Database Browser:</strong> ดู แก้ไข เพิ่ม หรือลบข้อมูลดิบในตารางฐานข้อมูลโดยตรง</li>
              <li><strong>สร้างบัญชีผู้ใช้:</strong> สร้างบัญชีสำหรับเข้าสู่ระบบและข้อมูลผู้ใช้ในขั้นตอนเดียว</li>
              <li><strong>สำรองและกู้คืนข้อมูล:</strong> ดาวน์โหลดไฟล์สำรองข้อมูล JSON และกู้คืนฐานข้อมูลด้วยไฟล์สำรอง</li>
              <li><strong>SQL Console:</strong> รันคำสั่ง SQL Query ด่วน เพื่อเขียนโค้ดวิเคราะห์ข้อมูลหรือทำรายการด่วนกับฐานข้อมูลหลังบ้าน</li>
            </ul>
          </div>
        </div>
    
        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 md:h-8.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-98 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
