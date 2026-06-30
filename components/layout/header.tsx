'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, HelpCircle, Home, UserCog } from 'lucide-react'
import { ITEM_TYPE_LABELS, ITEM_STATUS_LABELS, ItemType, ItemStatus } from '@/features/items/types'
import { cn } from '@/lib/utils'

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
          className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
          title="การตั้งค่าบัญชีส่วนบุคคล"
        >
          <UserCog className="h-4 w-4" />
        </Link>

        <button
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="คู่มือการใช้งาน"
          type="button"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <Link
          href="/profile"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-gradient-to-br from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-sm hover:scale-105 active:scale-95 transition-transform"
          title="การตั้งค่าบัญชีส่วนบุคคล"
        >
          {initials}
        </Link>
      </div>
    </header>
  )
}
