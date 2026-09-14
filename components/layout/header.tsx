'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { ITEM_TYPE_LABELS, ITEM_STATUS_LABELS, ItemType, ItemStatus } from '@/features/items/types'
import { cn } from '@/lib/utils'
const MobileNavigation = dynamic(() => import('./mobile-navigation').then((module) => module.MobileNavigation), { ssr: false })

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
      users: 'จัดการผู้ใช้งาน',
      'audit-logs': 'ประวัติการทำรายการ',
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
          <span key={segment} className="text-xs font-semibold text-slate-600 shrink-0">
            ขึ้นทะเบียนใหม่
          </span>
        )
      } else if (segment === 'edit') {
        breadcrumbs.push(
          <span key={segment} className="text-xs font-semibold text-slate-600 shrink-0">
            แก้ไขข้อมูล
          </span>
        )
      } else if (index === 1 && segments[0] === 'items') {
        // segment is ID
        breadcrumbs.push(
          <span key={segment} className="text-xs font-semibold text-slate-600 shrink-0">
            รายละเอียดพัสดุ
          </span>
        )
      } else {
        breadcrumbs.push(
          <span
            key={segment}
            className={cn(
              'text-xs font-semibold shrink-0',
              isLast ? 'text-slate-600' : 'text-slate-600 hover:text-blue-600 transition-colors'
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

      if (type) {
        breadcrumbs.push(
          <ChevronRight key="sep-type" className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )
        breadcrumbs.push(
          <span
            key="type"
            className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0 uppercase"
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
            className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0 uppercase"
          >
            {ITEM_STATUS_LABELS[status as ItemStatus]?.toLowerCase() ?? status}
          </span>
        )
      }
    }

    return breadcrumbs
  }

  return (
    <header className="relative z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pr-4">
        <MobileNavigation profile={profile} />
        {renderBreadcrumbs()}
      </div>

    </header>
  )
}
