'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { ITEM_TYPE_LABELS, ITEM_STATUS_LABELS, ItemType, ItemStatus } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { PATH_LABELS } from './nav-config'

const MobileNavigation = dynamic(() => import('./mobile-navigation').then((module) => module.MobileNavigation), { ssr: false })

interface HeaderProps {
  profile?: {
    full_name: string
    display_name?: string | null
    role: string
  } | null
}

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const renderBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null

    return (
      <nav aria-label="เส้นทางนำทาง" className="flex items-center">
        <ol className="flex items-center gap-1.5 list-none p-0 m-0">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1
            const label = PATH_LABELS[segment] || segment

            let content: React.ReactNode

            if (segment === 'items') {
              content = isLast ? (
                <span className="text-xs font-bold text-foreground shrink-0" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link
                  href="/items"
                  className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors shrink-0"
                >
                  {label}
                </Link>
              )
            } else if (segment === 'new') {
              content = (
                <span className="text-xs font-semibold text-foreground shrink-0" aria-current="page">
                  ขึ้นทะเบียนใหม่
                </span>
              )
            } else if (segment === 'edit') {
              content = (
                <span className="text-xs font-semibold text-foreground shrink-0" aria-current="page">
                  แก้ไขข้อมูล
                </span>
              )
            } else if (index === 1 && segments[0] === 'items') {
              // segment is ID
              content = isLast ? (
                <span className="text-xs font-semibold text-foreground shrink-0" aria-current="page">
                  รายละเอียดพัสดุ
                </span>
              ) : (
                <Link
                  href={`/items/${segment}`}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0"
                >
                  รายละเอียดพัสดุ
                </Link>
              )
            } else {
              content = (
                <span
                  className={cn(
                    'text-xs font-semibold shrink-0',
                    isLast ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  {...(isLast ? { 'aria-current': 'page' } : {})}
                >
                  {label}
                </span>
              )
            }

            return (
              <li key={`seg-${index}-${segment}`} className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                {content}
              </li>
            )
          })}

          {/* Add query parameters tags for /items page */}
          {pathname === '/items' && (() => {
            const type = searchParams.get('type')
            const status = searchParams.get('status')
            const tags: React.ReactNode[] = []

            if (type) {
              tags.push(
                <li key="tag-type" className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shrink-0 uppercase">
                    {ITEM_TYPE_LABELS[type as ItemType]?.toLowerCase() ?? type}
                  </span>
                </li>
              )
            }
            if (status) {
              tags.push(
                <li key="tag-status" className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 uppercase">
                    {ITEM_STATUS_LABELS[status as ItemStatus]?.toLowerCase() ?? status}
                  </span>
                </li>
              )
            }
            return tags
          })()}
        </ol>
      </nav>
    )
  }

  return (
    <header className="relative z-20 flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pr-4">
        <MobileNavigation profile={profile} />
        {renderBreadcrumbs()}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
      </div>
    </header>
  )
}
