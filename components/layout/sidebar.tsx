'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  User,
  History,
} from 'lucide-react'
import { signOut } from '@/features/auth/actions'

import { cn } from '@/lib/utils'

interface SidebarProps {
  profile: {
    full_name: string
    display_name?: string | null
    email: string | null
    role: string
  } | null
  sidebarData?: {
    categories: { id: string; name: string; icon?: string | null; count: number }[]
    locations: { id: string; name: string; count: number }[]
    counts: {
      total_assets: number
      total_supplies: number
      archive_count: number
      trash_count: number
    }
  }
}

interface NavItemTooltipProps {
  label: string
  enabled: boolean
  children: React.ReactElement
}

function NavItemTooltip({ label, enabled, children }: NavItemTooltipProps) {
  if (!enabled) return children

  return (
    <div className="relative group/tooltip flex items-center justify-center">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-full ml-2.5 z-50 hidden group-hover/tooltip:flex items-center rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md border border-border whitespace-nowrap animate-in fade-in-0 zoom-in-95"
      >
        {label}
      </div>
    </div>
  )
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('camms-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  // User-controlled manual overrides for admin folder expansion
  const [adminFolderManual, setAdminFolderManual] = useState<boolean | null>(true)

  const [optimisticTarget, setOptimisticTarget] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('camms-sidebar-collapsed', String(next))
      } catch {
        // Ignore localStorage error
      }
      return next
    })
  }

  const currentNavUrl = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname
  const [prevNavUrl, setPrevNavUrl] = useState(currentNavUrl)

  if (prevNavUrl !== currentNavUrl) {
    setPrevNavUrl(currentNavUrl)
    if (optimisticTarget !== null) {
      setOptimisticTarget(null)
    }
  }

  const handleOptimisticNavigate = (href: string) => {
    startTransition(() => {
      setOptimisticTarget(href)
    })
  }

  const currentPath = optimisticTarget ? optimisticTarget.split('?')[0] : pathname

  const isAdmin = profile?.role === 'admin'
  const disbursementsLabel = profile?.role === 'user' ? 'เบิก' : 'เบิก - จ่าย'
  const canWrite = isAdmin

  const isOverviewActive = currentPath === '/dashboard'

  const isCentralActive = currentPath === '/central-items'
  const isInventoryActive = currentPath === '/items'

  const isDisbursementsActive = currentPath.startsWith('/disbursements')

  const isSettingsActive = currentPath === '/settings'
  const isAuditLogsActive = currentPath.startsWith('/admin/audit-logs')
  const adminFolderExpanded = adminFolderManual ?? true

  const navItemClass = (isActive: boolean) =>
    cn(
      'group flex items-center rounded-lg font-medium outline-none transition-all duration-150 relative text-xs',
      'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1',
      isCollapsed ? 'justify-center h-9 w-9 mx-auto' : 'w-full px-2.5 py-2',
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r before:bg-primary'
        : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
    )

  const navIconClass = (_colorClass: string, isActive: boolean) =>
    cn(
      'h-4 w-4 shrink-0 transition-colors',
      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
      !isCollapsed && 'mr-2.5'
    )

  return (
    <aside
      aria-label="เมนูหลัก"
      className={cn(
        'relative z-30 hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-card md:flex select-none transition-all duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-sidebar-border',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          )}
        >
          <Link
            href="/dashboard"
            onPointerDown={() => handleOptimisticNavigate('/dashboard')}
            onClick={() => handleOptimisticNavigate('/dashboard')}
            className={cn(
              'flex items-center min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isCollapsed ? 'justify-center' : 'gap-2.5 flex-1'
            )}
            title="สำนักงานเขตสุขภาพที่ 7"
            aria-label="สำนักงานเขตสุขภาพที่ 7"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-2xs ring-1 ring-border/60 bg-white/95 p-0.5">
              <Image
                src="/images/moph-r7-emblem.webp"
                alt="โลโก้เขตสุขภาพที่ 7"
                width={32}
                height={32}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold tracking-tight text-foreground">Protal</div>
                <div className="truncate text-[10px] font-medium text-muted-foreground">สำนักงานเขตสุขภาพที่ 7</div>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="ย่อแถบเมนู"
              title="ย่อแถบเมนู"
              className="p-1 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expand Toggle Button for Collapsed Mode */}
        {isCollapsed && (
          <div className="flex justify-center pt-2 pb-1 border-b border-sidebar-border">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="ขยายแถบเมนู"
              title="ขยายแถบเมนู"
              className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-4">
          {/* Main / Overview */}
          <div className="space-y-1">
            <NavItemTooltip label="Dashboard" enabled={isCollapsed}>
              <Link
                href="/dashboard"
                onPointerDown={() => handleOptimisticNavigate('/dashboard')}
                onClick={() => handleOptimisticNavigate('/dashboard')}
                aria-current={isOverviewActive ? 'page' : undefined}
                className={navItemClass(isOverviewActive)}
              >
                <LayoutDashboard className={navIconClass('text-sky-500', isOverviewActive)} />
                {!isCollapsed && <span className="truncate">Dashboard</span>}
              </Link>
            </NavItemTooltip>
          </div>

          {/* Group 1: งานทะเบียนพัสดุ */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                งานทะเบียนพัสดุ
              </p>
            ) : (
              <div className="my-1 border-t border-sidebar-border" />
            )}

            {/* ครุภัณฑ์ */}
            <NavItemTooltip label="คลัง" enabled={isCollapsed}>
              <Link
                href="/items"
                onPointerDown={() => handleOptimisticNavigate('/items')}
                onClick={() => handleOptimisticNavigate('/items')}
                aria-current={isInventoryActive ? 'page' : undefined}
                className={cn(
                  navItemClass(isInventoryActive),
                  !isCollapsed && 'justify-between'
                )}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <Package className={navIconClass('text-blue-500', isInventoryActive)} />
                  {!isCollapsed && <span className="truncate">คลัง</span>}
                </div>
              </Link>
            </NavItemTooltip>

            <NavItemTooltip label="ส่วนกลาง" enabled={isCollapsed}>
              <Link
                href="/central-items"
                onPointerDown={() => handleOptimisticNavigate('/central-items')}
                onClick={() => handleOptimisticNavigate('/central-items')}
                aria-current={isCentralActive ? 'page' : undefined}
                className={navItemClass(isCentralActive)}
              >
                <Boxes className={navIconClass('text-emerald-500', isCentralActive)} />
                {!isCollapsed && <span className="truncate">ส่วนกลาง</span>}
              </Link>
            </NavItemTooltip>

            <NavItemTooltip label={disbursementsLabel} enabled={isCollapsed}>
              <Link
                href="/disbursements"
                onPointerDown={() => handleOptimisticNavigate('/disbursements')}
                onClick={() => handleOptimisticNavigate('/disbursements')}
                aria-current={isDisbursementsActive ? 'page' : undefined}
                className={navItemClass(isDisbursementsActive)}
              >
                <Boxes className={navIconClass('text-orange-500', isDisbursementsActive)} />
                {!isCollapsed && <span className="truncate">{disbursementsLabel}</span>}
              </Link>
            </NavItemTooltip>



          </div>

          {/* Group 3: จัดการระบบ (Collapsible Accordion for Enterprise UI) */}
          {canWrite && (
            <div className="space-y-1 pt-1">
              {!isCollapsed ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setAdminFolderManual((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer rounded"
                  >
                    <span>จัดการระบบ</span>
                    {adminFolderExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>

                  {adminFolderExpanded && (
                    <div className="space-y-0.5 pt-1 pl-1 transition-all duration-150 motion-reduce:transition-none">
                      {/* System Settings - Admin & Staff */}
                      <Link
                        href="/settings"
                        onPointerDown={() => handleOptimisticNavigate('/settings')}
                        onClick={() => handleOptimisticNavigate('/settings')}
                        aria-current={isSettingsActive ? 'page' : undefined}
                        className={navItemClass(isSettingsActive)}
                      >
                        <Settings className={navIconClass('text-violet-500', isSettingsActive)} />
                        <span className="truncate">ตั้งค่าระบบ</span>
                      </Link>

                      {/* Audit Logs Explorer - Admin Only */}
                      {isAdmin && (
                        <Link
                          href="/admin/audit-logs"
                          onPointerDown={() => handleOptimisticNavigate('/admin/audit-logs')}
                          onClick={() => handleOptimisticNavigate('/admin/audit-logs')}
                          aria-current={isAuditLogsActive ? 'page' : undefined}
                          className={navItemClass(isAuditLogsActive)}
                        >
                          <History className={navIconClass('text-orange-500', isAuditLogsActive)} />
                          <span className="truncate">Logs</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* In collapsed mode, render direct icon buttons with tooltips */
                <div className="space-y-1">
                  <div className="my-1 border-t border-sidebar-border" />
                  <NavItemTooltip label="ตั้งค่าระบบ" enabled={isCollapsed}>
                    <Link
                      href="/settings"
                      onPointerDown={() => handleOptimisticNavigate('/settings')}
                      onClick={() => handleOptimisticNavigate('/settings')}
                      aria-current={isSettingsActive ? 'page' : undefined}
                      className={navItemClass(isSettingsActive)}
                    >
                      <Settings className={navIconClass('text-violet-500', isSettingsActive)} />
                    </Link>
                  </NavItemTooltip>

                  {isAdmin && (
                    <NavItemTooltip label="Logs" enabled={isCollapsed}>
                      <Link
                        href="/admin/audit-logs"
                        onPointerDown={() => handleOptimisticNavigate('/admin/audit-logs')}
                        onClick={() => handleOptimisticNavigate('/admin/audit-logs')}
                        aria-current={isAuditLogsActive ? 'page' : undefined}
                        className={navItemClass(isAuditLogsActive)}
                      >
                        <History className={navIconClass('text-orange-500', isAuditLogsActive)} />
                      </Link>
                    </NavItemTooltip>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer Area: Profile & Logout */}
        <div data-footer className="border-t border-sidebar-border bg-sidebar/40 p-2 shrink-0">
          {profile && (
            <NavItemTooltip
              label={profile.display_name?.trim() || profile.full_name}
              enabled={isCollapsed}
            >
              <Link
                href="/profile"
                onPointerDown={() => handleOptimisticNavigate('/profile')}
                onClick={() => handleOptimisticNavigate('/profile')}
                aria-current={currentPath === '/profile' ? 'page' : undefined}
                className={cn(
                  'mb-1.5 flex items-center rounded-lg border border-sidebar-border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group',
                  isCollapsed ? 'justify-center h-9 w-9 mx-auto p-0' : 'p-2 gap-2 bg-card/60 hover:bg-sidebar-accent',
                  currentPath === '/profile'
                    ? 'bg-primary/10 border-primary/20 shadow-xs'
                    : 'hover:border-sidebar-border'
                )}
                title="บัญชีผู้ใช้"
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                    currentPath === '/profile'
                      ? 'border-primary/20 bg-primary text-primary-foreground'
                      : 'border-sidebar-border bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20'
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-xs font-semibold leading-tight transition-colors',
                        currentPath === '/profile'
                          ? 'text-primary font-bold'
                          : 'text-foreground group-hover:text-primary'
                      )}
                    >
                      {profile.display_name?.trim() || profile.full_name}
                    </p>
                  </div>
                )}
              </Link>
            </NavItemTooltip>
          )}

          <div className={cn('flex items-center gap-1.5', isCollapsed && 'flex-col')}>
            <NavItemTooltip label="ออกจากระบบ" enabled={isCollapsed}>
              <form action={signOut} className={isCollapsed ? 'flex justify-center' : 'flex-1 min-w-0'}>
                <button
                  type="submit"
                  aria-label="ออกจากระบบ"
                  className={cn(
                    'flex items-center rounded-lg text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                    isCollapsed ? 'h-9 w-9 justify-center p-0' : 'w-full px-2.5 py-1.5 gap-2'
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>ออกจากระบบ</span>}
                </button>
              </form>
            </NavItemTooltip>
          </div>
        </div>
      </aside>
  )
}
