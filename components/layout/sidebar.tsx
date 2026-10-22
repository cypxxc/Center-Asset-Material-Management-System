'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Armchair,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Layers,
  Laptop,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  Tag,
  User,
  UserCog,
  Database,
  History,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { signOut } from '@/features/auth/actions'
import { NewItemDialogTrigger } from '@/features/items/components/new-item-dialog-provider'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from './nav-config'

interface SidebarProps {
  profile: {
    full_name: string
    display_name?: string | null
    email: string
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

function renderCategoryIcon(_iconName?: string | null, categoryName?: string) {
  const n = (categoryName || '').toLowerCase()
  if (
    n.includes('comp') ||
    n.includes('จอ') ||
    n.includes('พิมพ์') ||
    n.includes('it') ||
    n.includes('tech') ||
    n.includes('คอม')
  ) {
    return <Laptop className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
  }
  if (
    n.includes('โต๊ะ') ||
    n.includes('เก้าอี้') ||
    n.includes('เฟอร์') ||
    n.includes('furn') ||
    n.includes('chair')
  ) {
    return <Armchair className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
  }
  return <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
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

export function Sidebar({ profile, sidebarData }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type')
  const currentCategory = searchParams.get('category_id')
  const currentLocation = searchParams.get('location_id')

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('camms-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  // User-controlled manual overrides for folder expansion
  const [assetsFolderManual, setAssetsFolderManual] = useState<boolean | null>(null)
  const [locationsFolderManual, setLocationsFolderManual] = useState<boolean | null>(null)
  const [adminFolderManual, setAdminFolderManual] = useState<boolean | null>(null)

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
  const currentQueryStr = optimisticTarget?.includes('?') ? optimisticTarget.split('?')[1] : null
  const effType = currentQueryStr !== null ? new URLSearchParams(currentQueryStr).get('type') : currentType
  const effCategory = currentQueryStr !== null ? new URLSearchParams(currentQueryStr).get('category_id') : currentCategory
  const effLocation = currentQueryStr !== null ? new URLSearchParams(currentQueryStr).get('location_id') : currentLocation

  const categories = sidebarData?.categories ?? []
  const locations = sidebarData?.locations ?? []
  const counts = sidebarData?.counts ?? {
    total_assets: 0,
    total_supplies: 0,
    archive_count: 0,
    trash_count: 0,
  }

  const totalAssetsCount = counts.total_assets
  const totalSuppliesCount = counts.total_supplies

  const getCategoryCount = (catId: string) => {
    return categories.find((c) => c.id === catId)?.count ?? 0
  }

  const getLocationCount = (locId: string) => {
    return locations.find((l) => l.id === locId)?.count ?? 0
  }

  const isAdmin = profile?.role === 'admin'
  const isStaff = profile?.role === 'staff'
  const canWrite = isAdmin || isStaff

  const isOverviewActive = currentPath === '/dashboard'

  const isAllItemsActive =
    currentPath === '/items' &&
    !effType &&
    !effCategory &&
    !effLocation

  const isAssetsActive =
    currentPath === '/items' &&
    effType === 'asset' &&
    !effCategory

  const isSuppliesActive =
    currentPath === '/items' &&
    effType === 'material'

  const isLocationsActive =
    currentPath === '/locations' &&
    !effLocation

  const isReportsActive = currentPath === '/reports'

  const isSettingsActive = currentPath === '/settings'
  const isUsersActive = currentPath.startsWith('/admin/users')
  const isAuditLogsActive = currentPath.startsWith('/admin/audit-logs')
  const isDbPanelActive = currentPath.startsWith('/admin/db-panel')
  const isAdminActive = isSettingsActive || isUsersActive || isAuditLogsActive || isDbPanelActive

  // Compute folder expanded states: manual override wins; defaults to true if active child route
  const assetsFolderExpanded = assetsFolderManual ?? Boolean(effCategory)
  const locationsFolderExpanded = locationsFolderManual ?? Boolean(effLocation)
  const adminFolderExpanded = adminFolderManual ?? isAdminActive

  const navItemClass = (isActive: boolean) =>
    cn(
      'group flex items-center rounded-md font-medium outline-none transition-colors duration-150',
      'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1',
      isCollapsed ? 'justify-center h-9 w-9 mx-auto' : 'w-full px-2.5 py-2 text-xs',
      isActive
        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs'
        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    )

  const navIconClass = (colorClass: string, isActive: boolean) =>
    cn(
      'h-4 w-4 shrink-0 transition-colors',
      isActive ? 'text-primary' : colorClass,
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
            'flex h-13 shrink-0 items-center border-b border-sidebar-border',
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
            title="CAMMS Portal"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Package className="h-4 w-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold tracking-tight text-foreground">CAMMS Portal</div>
                <div className="truncate text-[10px] font-normal text-muted-foreground">ระบบทะเบียนครุภัณฑ์และวัสดุ</div>
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
              <PanelLeftClose className="h-4 w-4" />
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
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action Button: ขึ้นทะเบียนใหม่ */}
        {canWrite && (
          <div className={cn('border-b border-sidebar-border', isCollapsed ? 'p-2 flex justify-center' : 'px-3 py-2.5')}>
            <NavItemTooltip label="ขึ้นทะเบียนใหม่" enabled={isCollapsed}>
              <NewItemDialogTrigger
                className={cn(
                  'flex items-center justify-center font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isCollapsed ? 'h-9 w-9 p-0' : 'w-full py-2 px-3 text-xs gap-1.5'
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span className="font-semibold truncate">ขึ้นทะเบียนใหม่</span>}
              </NewItemDialogTrigger>
            </NavItemTooltip>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-4">
          {/* Main / Overview */}
          <div className="space-y-1">
            <NavItemTooltip label="แผงควบคุม" enabled={isCollapsed}>
              <Link
                href="/dashboard"
                onPointerDown={() => handleOptimisticNavigate('/dashboard')}
                onClick={() => handleOptimisticNavigate('/dashboard')}
                aria-current={isOverviewActive ? 'page' : undefined}
                className={navItemClass(isOverviewActive)}
              >
                <LayoutDashboard className={navIconClass('text-sky-500', isOverviewActive)} />
                {!isCollapsed && <span className="truncate">แผงควบคุม</span>}
              </Link>
            </NavItemTooltip>
          </div>

          {/* Group 1: ทะเบียนพัสดุ */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                ทะเบียนพัสดุ
              </p>
            ) : (
              <div className="my-1 border-t border-sidebar-border" />
            )}

            {/* รายการทั้งหมด */}
            <NavItemTooltip label="รายการทั้งหมด" enabled={isCollapsed}>
              <Link
                href="/items"
                onPointerDown={() => handleOptimisticNavigate('/items')}
                onClick={() => handleOptimisticNavigate('/items')}
                aria-current={isAllItemsActive ? 'page' : undefined}
                className={navItemClass(isAllItemsActive)}
              >
                <Layers className={navIconClass('text-indigo-500', isAllItemsActive)} />
                {!isCollapsed && <span className="truncate">รายการทั้งหมด</span>}
              </Link>
            </NavItemTooltip>

            {/* ครุภัณฑ์ */}
            <div className="space-y-0.5">
              <div
                className={cn(
                  'group flex items-center rounded-md font-medium transition-colors duration-150',
                  isCollapsed ? 'justify-center h-9 w-9 mx-auto' : 'w-full px-1 py-0.5',
                  isAssetsActive
                    ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {!isCollapsed && (
                  <button
                    type="button"
                    aria-label="แสดงหรือซ่อนหมวดหมู่ครุภัณฑ์"
                    aria-expanded={assetsFolderExpanded}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setAssetsFolderManual((prev) => (prev ?? Boolean(effCategory)) ? false : true)
                    }}
                    className="p-1 rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
                  >
                    {assetsFolderExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150" />
                    )}
                  </button>
                )}

                <NavItemTooltip label={`ครุภัณฑ์ (${totalAssetsCount})`} enabled={isCollapsed}>
                  <Link
                    href="/items?type=asset"
                    onPointerDown={() => handleOptimisticNavigate('/items?type=asset')}
                    onClick={() => handleOptimisticNavigate('/items?type=asset')}
                    aria-current={isAssetsActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center min-w-0 flex-1 py-1.5 outline-none rounded focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      isCollapsed ? 'justify-center p-0' : 'px-1 text-xs'
                    )}
                  >
                    <Package className={navIconClass('text-blue-500', isAssetsActive)} />
                    {!isCollapsed && <span className="truncate flex-1 text-left">ครุภัณฑ์</span>}
                  </Link>
                </NavItemTooltip>

                {!isCollapsed && (
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                    {totalAssetsCount}
                  </span>
                )}
              </div>

              {/* Sub-categories */}
              {!isCollapsed && assetsFolderExpanded && (
                <div className="pl-5 ml-3 border-l border-sidebar-border space-y-0.5 pt-0.5 transition-all duration-150 motion-reduce:transition-none">
                  {categories.map((cat) => {
                    const href = `/items?type=asset&category_id=${cat.id}`
                    const isCurrent = effCategory === cat.id && currentPath === '/items'
                    const count = getCategoryCount(cat.id)
                    return (
                      <Link
                        key={cat.id}
                        href={href}
                        onPointerDown={() => handleOptimisticNavigate(href)}
                        onClick={() => handleOptimisticNavigate(href)}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                          'text-left py-1.5 px-2 rounded-md flex items-center justify-between text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          isCurrent
                            ? 'bg-primary/10 text-primary font-bold shadow-xs'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <div className="flex items-center min-w-0 pr-1">
                          {renderCategoryIcon(cat.icon, cat.name)}
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                          {count}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* วัสดุ */}
            <NavItemTooltip label={`วัสดุ (${totalSuppliesCount})`} enabled={isCollapsed}>
              <Link
                href="/items?type=material"
                onPointerDown={() => handleOptimisticNavigate('/items?type=material')}
                onClick={() => handleOptimisticNavigate('/items?type=material')}
                aria-current={isSuppliesActive ? 'page' : undefined}
                className={cn(
                  navItemClass(isSuppliesActive),
                  !isCollapsed && 'justify-between'
                )}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <Boxes className={navIconClass('text-amber-500', isSuppliesActive)} />
                  {!isCollapsed && <span className="truncate">วัสดุ</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                    {totalSuppliesCount}
                  </span>
                )}
              </Link>
            </NavItemTooltip>

            {/* สถานที่ */}
            <div className="space-y-0.5">
              <div
                className={cn(
                  'group flex items-center rounded-md font-medium transition-colors duration-150',
                  isCollapsed ? 'justify-center h-9 w-9 mx-auto' : 'w-full px-1 py-0.5',
                  isLocationsActive
                    ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {!isCollapsed && (
                  <button
                    type="button"
                    aria-label="แสดงหรือซ่อนรายการสถานที่"
                    aria-expanded={locationsFolderExpanded}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLocationsFolderManual((prev) => (prev ?? Boolean(effLocation)) ? false : true)
                    }}
                    className="p-1 rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
                  >
                    {locationsFolderExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150" />
                    )}
                  </button>
                )}

                <NavItemTooltip label={`สถานที่ (${locations.length})`} enabled={isCollapsed}>
                  <Link
                    href="/locations"
                    onPointerDown={() => handleOptimisticNavigate('/locations')}
                    onClick={() => handleOptimisticNavigate('/locations')}
                    aria-current={isLocationsActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center min-w-0 flex-1 py-1.5 outline-none rounded focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      isCollapsed ? 'justify-center p-0' : 'px-1 text-xs'
                    )}
                  >
                    <MapPin className={navIconClass('text-rose-500', isLocationsActive)} />
                    {!isCollapsed && <span className="truncate flex-1 text-left">สถานที่</span>}
                  </Link>
                </NavItemTooltip>

                {!isCollapsed && (
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                    {locations.length}
                  </span>
                )}
              </div>

              {/* Sub-locations */}
              {!isCollapsed && locationsFolderExpanded && (
                <div className="pl-5 ml-3 border-l border-sidebar-border space-y-0.5 pt-0.5 transition-all duration-150 motion-reduce:transition-none">
                  {locations.map((loc) => {
                    const href = `/items?location_id=${loc.id}`
                    const isCurrent = effLocation === loc.id && currentPath === '/items'
                    const count = getLocationCount(loc.id)
                    return (
                      <Link
                        key={loc.id}
                        href={href}
                        onPointerDown={() => handleOptimisticNavigate(href)}
                        onClick={() => handleOptimisticNavigate(href)}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                          'text-left py-1.5 px-2 rounded-md flex items-center justify-between text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          isCurrent
                            ? 'bg-primary/10 text-primary font-bold shadow-xs'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <span className="truncate pr-1">{loc.name}</span>
                        <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                          {count}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Group 2: สรุปข้อมูล / รายงาน */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                สรุปข้อมูล
              </p>
            ) : (
              <div className="my-1 border-t border-sidebar-border" />
            )}

            <NavItemTooltip label="รายงาน" enabled={isCollapsed}>
              <Link
                href="/reports"
                onPointerDown={() => handleOptimisticNavigate('/reports')}
                onClick={() => handleOptimisticNavigate('/reports')}
                aria-current={isReportsActive ? 'page' : undefined}
                className={navItemClass(isReportsActive)}
              >
                <BarChart3 className={navIconClass('text-emerald-500', isReportsActive)} />
                {!isCollapsed && <span className="truncate">รายงาน</span>}
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
                    onClick={() => setAdminFolderManual((prev) => (prev ?? isAdminActive) ? false : true)}
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
                        <span className="truncate">ตั้งค่าระบบหลัก</span>
                      </Link>

                      {/* User Management - Admin Only */}
                      {isAdmin && (
                        <Link
                          href="/admin/users"
                          onPointerDown={() => handleOptimisticNavigate('/admin/users')}
                          onClick={() => handleOptimisticNavigate('/admin/users')}
                          aria-current={isUsersActive ? 'page' : undefined}
                          className={navItemClass(isUsersActive)}
                        >
                          <UserCog className={navIconClass('text-purple-500', isUsersActive)} />
                          <span className="truncate">จัดการผู้ใช้งาน</span>
                        </Link>
                      )}

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
                          <span className="truncate">ประวัติการทำรายการ</span>
                        </Link>
                      )}

                      {/* Database Panel - Admin Only */}
                      {isAdmin && (
                        <Link
                          href="/admin/db-panel"
                          onPointerDown={() => handleOptimisticNavigate('/admin/db-panel')}
                          onClick={() => handleOptimisticNavigate('/admin/db-panel')}
                          aria-current={isDbPanelActive ? 'page' : undefined}
                          className={navItemClass(isDbPanelActive)}
                        >
                          <Database className={navIconClass('text-teal-500', isDbPanelActive)} />
                          <span className="truncate">จัดการฐานข้อมูล</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* In collapsed mode, render direct icon buttons with tooltips */
                <div className="space-y-1">
                  <div className="my-1 border-t border-sidebar-border" />
                  <NavItemTooltip label="ตั้งค่าระบบหลัก" enabled={isCollapsed}>
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
                    <NavItemTooltip label="จัดการผู้ใช้งาน" enabled={isCollapsed}>
                      <Link
                        href="/admin/users"
                        onPointerDown={() => handleOptimisticNavigate('/admin/users')}
                        onClick={() => handleOptimisticNavigate('/admin/users')}
                        aria-current={isUsersActive ? 'page' : undefined}
                        className={navItemClass(isUsersActive)}
                      >
                        <UserCog className={navIconClass('text-purple-500', isUsersActive)} />
                      </Link>
                    </NavItemTooltip>
                  )}

                  {isAdmin && (
                    <NavItemTooltip label="ประวัติการทำรายการ" enabled={isCollapsed}>
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

                  {isAdmin && (
                    <NavItemTooltip label="จัดการฐานข้อมูล" enabled={isCollapsed}>
                      <Link
                        href="/admin/db-panel"
                        onPointerDown={() => handleOptimisticNavigate('/admin/db-panel')}
                        onClick={() => handleOptimisticNavigate('/admin/db-panel')}
                        aria-current={isDbPanelActive ? 'page' : undefined}
                        className={navItemClass(isDbPanelActive)}
                      >
                        <Database className={navIconClass('text-teal-500', isDbPanelActive)} />
                      </Link>
                    </NavItemTooltip>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer Area: Profile & Logout */}
        <div className="border-t border-sidebar-border bg-sidebar/40 p-2 shrink-0">
          {profile && (
            <NavItemTooltip
              label={`${profile.display_name?.trim() || profile.full_name} (${ROLE_LABELS[profile.role] ?? profile.role})`}
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
                title="ตั้งค่าบัญชีส่วนบุคคล"
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
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </p>
                  </div>
                )}
              </Link>
            </NavItemTooltip>
          )}

          <NavItemTooltip label="ออกจากระบบ" enabled={isCollapsed}>
            <form action={signOut} className={isCollapsed ? 'flex justify-center' : 'w-full'}>
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
      </aside>
  )
}
