'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { 
  ChevronRight, 
  HelpCircle, 
  Home, 
  UserCog,
  X,
  BookOpen,
  Shield,
  User,
  Package,
  AlertTriangle,
  FileText,
  Settings,
  Database,
  Menu,
  LogOut,
  Trash2
} from 'lucide-react'
import { ITEM_TYPE_LABELS, ITEM_STATUS_LABELS, ItemType, ItemStatus } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { signOut } from '@/features/auth/actions'

interface HeaderProps {
  title?: string
  profile?: {
    full_name: string
    role: string
  } | null
}

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showGuide, setShowGuide] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'R'

  const renderBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: React.ReactNode[] = []

    const pathLabels: Record<string, string> = {
      items: 'รายการพัสดุ',
      locations: 'สถานที่ตั้ง',
      reports: 'สรุปรายงาน',
      settings: 'ตั้งค่าระบบ',
      profile: 'โปรไฟล์',
      dashboard: 'แผงควบคุม',
      admin: 'ผู้ดูแลระบบ',
      'db-panel': 'จัดการฐานข้อมูล',
    }

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1
      const label = pathLabels[segment] || segment

      breadcrumbs.push(
        <ChevronRight key={`sep-${index}`} className="h-3.5 w-3.5 text-slate-300 shrink-0" />
      )

      if (segment === 'items') {
        breadcrumbs.push(
          <Link
            key={segment}
            href="/items"
            className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors shrink-0"
          >
            {label}
          </Link>
        )
      } else if (segment === 'new') {
        breadcrumbs.push(
          <span key={segment} className="text-xs font-semibold text-slate-400 shrink-0">
            ขึ้นทะเบียนใหม่
          </span>
        )
      } else if (segment === 'edit') {
        breadcrumbs.push(
          <span key={segment} className="text-xs font-semibold text-slate-400 shrink-0">
            แก้ไขข้อมูล
          </span>
        )
      } else if (index === 1 && segments[0] === 'items') {
        // segment is ID
        breadcrumbs.push(
          <span key={segment} className="text-xs font-semibold text-slate-400 shrink-0">
            รายละเอียดพัสดุ
          </span>
        )
      } else {
        breadcrumbs.push(
          <span
            key={segment}
            className={cn(
              'text-xs font-semibold shrink-0',
              isLast ? 'text-slate-400' : 'text-slate-600 hover:text-blue-600 transition-colors'
            )}
          >
            {label}
          </span>
        )
      }
    })

    // Add query parameters tags for /items page
    if (pathname === '/items') {
      const type = searchParams.get('type')
      const status = searchParams.get('status')
      const q = searchParams.get('q')

      if (type) {
        breadcrumbs.push(
          <ChevronRight key="sep-type" className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )
        breadcrumbs.push(
          <span
            key="type"
            className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0 uppercase"
          >
            {ITEM_TYPE_LABELS[type as ItemType]?.toLowerCase() ?? type}
          </span>
        )
      }
      if (status) {
        breadcrumbs.push(
          <ChevronRight key="sep-status" className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )
        breadcrumbs.push(
          <span
            key="status"
            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0 uppercase"
          >
            {ITEM_STATUS_LABELS[status as ItemStatus]?.toLowerCase() ?? status}
          </span>
        )
      }
      if (q) {
        breadcrumbs.push(
          <ChevronRight key="sep-q" className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )
        breadcrumbs.push(
          <span
            key="q"
            className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shrink-0 uppercase"
          >
            search:{q.toLowerCase()}
          </span>
        )
      }
    }

    return breadcrumbs
  }

  return (
    <header className="relative z-20 flex h-[52px] w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pr-4">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="เปิดเมนูนำทาง"
          className="flex md:hidden mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer shrink-0"
          title="เมนูนำทาง"
          type="button"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>

        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-100 shrink-0"
        >
          <Home className="h-3.5 w-3.5 text-blue-600" />
          <span className="hidden sm:inline">หน้าหลัก</span>
        </Link>

        {renderBreadcrumbs()}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/profile"
          aria-label="การตั้งค่าบัญชีส่วนตัว"
          className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
          title="การตั้งค่าบัญชีส่วนตัว"
        >
          <UserCog className="h-4 w-4" />
        </Link>

        <button
          onClick={() => setShowGuide(true)}
          aria-label="เปิดคู่มือการใช้งาน"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          title="คู่มือการใช้งาน"
          type="button"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <Link
          href="/profile"
          aria-label="ส่วนตัว — การตั้งค่าบัญชี"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-gradient-to-br from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-sm hover:scale-105 active:scale-95 transition-transform"
          title="การตั้งค่าบัญชีส่วนตัว"
        >
          {initials}
        </Link>
      </div>

      {/* User Guide Modal Overlay */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <h2 className="flex items-center gap-2 text-sm md:text-base font-bold text-slate-800">
                <BookOpen className="h-5 w-5 text-blue-600" />
                คู่มือการใช้งานระบบทะเบียนสิ่งของ (CAMMS User Guide)
              </h2>
              <button
                onClick={() => setShowGuide(false)}
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
                  ระบบ Center Asset Material Management System (CAMMS) เป็นระบบสำหรับลงทะเบียน ตรวจสอบ และบริหารจัดการทะเบียนพัสดุ วัสดุสิ้นเปลือง และครุภัณฑ์ภายในสำนักงานอย่างมีประสิทธิภาพ
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
                        <td className="p-2.5">พิมพ์รายงาน และ Export ข้อมูลเป็น Excel/PDF</td>
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
                        <td className="p-2.5">ลบสิ่งของชั่วคราวลงถังขยะ (Soft Delete)</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-2.5">เข้าสู่ระบบจัดการถังขยะ และกู้คืนข้อมูล (Restore)</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-2.5">ลบสิ่งของถาวรออกจากฐานข้อมูล (Hard Delete)</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-2.5">ตั้งค่าข้อมูลระบบ (ประเภท/หมวดหมู่/สถานที่)</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">✔</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                        <td className="p-2.5 text-center text-rose-500 font-bold">✘</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-2.5">เข้าใช้แผงควบคุมฐานข้อมูลระดับสูง (DB Admin Panel)</td>
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
                  <li><strong>การเข้าสู่ระบบ:</strong> กรอก รหัสผู้ใช้/อีเมล และรหัสผ่านที่ได้รับจากแอดมิน หากบัญชีโดนระงับใช้งาน (Inactive) ระบบจะไม่ยอมให้เข้าสู่ระบบ</li>
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
                  <li><strong>การค้นหาแบบด่วน:</strong> สามารถพิมพ์ค้นหาด้วย ชื่อ, เลขครุภัณฑ์, Serial No, ยี่ห้อ, รุ่น หรือผู้รับผิดชอบ ผ่านแถบค้นหาแบบ Real-time</li>
                  <li><strong>การกรองข้อมูล:</strong> คัดกรองตามหมวดหมู่ สถานที่ตั้งจัดเก็บ หรือสถานะการใช้งาน</li>
                  <li><strong>ขึ้นทะเบียนใหม่:</strong> เลือกประเภทสิ่งของ (วัสดุสิ้นเปลือง / ครุภัณฑ์) กรอกรายละเอียด และสามารถอัปโหลดรูปภาพเพื่อประกอบทะเบียนสิ่งของได้</li>
                  <li><strong>Bulk Actions:</strong> สามารถเลือกพัสดุพร้อมกันหลายๆ ชิ้นเพื่อแก้ไขสถานที่จัดเก็บ หรือแก้ไขสถานะการทำงานพร้อมกันได้ในครั้งเดียว</li>
                </ul>
              </div>

              {/* Trash & Recovery */}
              <div className="space-y-3">
                <h3 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  ระบบถังขยะและการกู้คืนข้อมูล (Trash & Recovery)
                </h3>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] md:text-xs text-amber-900 space-y-2">
                  <p><strong>การลบชั่วคราว (Soft Delete):</strong> เฉพาะแอดมินเท่านั้นที่สั่งลบสิ่งของลงถังขยะได้ รายการที่ถูกลบจะย้ายมาที่หน้าถังขยะเพื่อกันการสูญหาย</p>
                  <p><strong>การกู้คืนสิ่งของ (Restore):</strong> สิทธิ์ Admin และ Staff สามารถดึงของในถังขยะกลับคืนสู่ระบบหลักได้ตลอดเวลา</p>
                  <p><strong>การลบถาวร (Hard Delete):</strong> แอดมิน (Admin) เท่านั้นที่สั่งลบถาวรได้ โดยระบบจะทำลายข้อมูลในฐานข้อมูลและถอนไฟล์รูปภาพออกจากพื้นที่เก็บข้อมูลออนไลน์โดยตรง</p>
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
                  <li><strong>Create Auth User:</strong> สร้างบัญชีผู้ใช้เข้าสู่ระบบพร้อมสร้าง Profile อะตอมมิกพร้อมกันในคลิกเดียว</li>
                  <li><strong>Backup & Restore:</strong> ดาวน์โหลดไฟล์สำรองข้อมูล JSON และกู้คืนฐานข้อมูลผ่านการแนบไฟล์ดิสก์</li>
                  <li><strong>SQL Console:</strong> รันคำสั่ง SQL Query ด่วน เพื่อเขียนโค้ดวิเคราะห์ข้อมูลหรือทำรายการด่วนกับฐานข้อมูลหลังบ้าน</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="h-8 md:h-8.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-98 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[280px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex h-[52px] items-center justify-between border-b border-slate-200 px-4">
              <span className="font-extrabold text-sm text-slate-800">เมนูนำทาง</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 text-slate-700 text-sm font-semibold">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/dashboard' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                )}
              >
                <Home className="h-4 w-4 text-blue-600" />
                <span>แผงควบคุม (Dashboard)</span>
              </Link>

              <Link
                href="/items"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && !searchParams.get('type') && !searchParams.get('deleted') ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                )}
              >
                <Package className="h-4 w-4 text-slate-500" />
                <span>พัสดุทั้งหมด (All Items)</span>
              </Link>

              <Link
                href="/items?type=asset"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && searchParams.get('type') === 'asset' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                )}
              >
                <Package className="h-4 w-4 text-slate-500" />
                <span>ทะเบียนครุภัณฑ์ (Assets)</span>
              </Link>

              <Link
                href="/items?type=material"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && searchParams.get('type') === 'material' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                )}
              >
                <Package className="h-4 w-4 text-slate-500" />
                <span>วัสดุสิ้นเปลือง (Supplies)</span>
              </Link>

              {profile?.role && ['admin', 'staff'].includes(profile.role) && (
                <Link
                  href="/items?deleted=true"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    searchParams.get('deleted') === 'true' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                  )}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <span>ถังขยะ (Trash)</span>
                </Link>
              )}

              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/settings' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                )}
              >
                <Settings className="h-4 w-4 text-slate-500" />
                <span>ตั้งค่าระบบ (Settings)</span>
              </Link>

              {profile?.role === 'admin' && (
                <Link
                  href="/admin/db-panel"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    pathname.startsWith('/admin') ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                  )}
                >
                  <Database className="h-4 w-4 text-slate-500" />
                  <span>จัดการฐานข้อมูล (DB Panel)</span>
                </Link>
              )}
            </nav>

            {/* Footer containing profile & signout */}
            <div className="border-t border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-xs font-bold text-slate-800">{profile?.full_name}</div>
                  <div className="truncate text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{profile?.role}</div>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </form>
            </div>
          </div>
          {/* Backdrop click close */}
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  )
}
