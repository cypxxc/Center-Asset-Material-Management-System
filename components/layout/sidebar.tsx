'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Armchair,
  BarChart2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Grid,
  Laptop,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  User,
  UserCog,
  Database,
  History,
} from 'lucide-react'
import { signOut } from '@/features/auth/actions'
import { NewItemDialogTrigger } from '@/features/items/components/new-item-dialog-provider'
import { cn } from '@/lib/utils'

interface SidebarProps {
  profile: {
    full_name: string
    display_name?: string | null
    email: string
    role: string
  } | null
  sidebarData?: {
    categories: { id: string; name: string; count: number }[]
    locations: { id: string; name: string; count: number }[]
    counts: {
      total_assets: number
      total_supplies: number
      archive_count: number
      trash_count: number
    }
  }
}

const roleLabels: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  staff: 'เจ้าหน้าที่',
  viewer: 'ผู้เข้าชม',
}

function getCategoryIcon(name: string) {
  const n = name.toLowerCase()
  if (
    n.includes('comp') ||
    n.includes('จอ') ||
    n.includes('พิมพ์') ||
    n.includes('it') ||
    n.includes('tech') ||
    n.includes('คอม')
  ) {
    return <Laptop className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
  }
  if (
    n.includes('โต๊ะ') ||
    n.includes('เก้าอี้') ||
    n.includes('เฟอร์') ||
    n.includes('furn') ||
    n.includes('chair')
  ) {
    return <Armchair className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
  }
  return <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
}

export function Sidebar({ profile, sidebarData }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type')
  const currentCategory = searchParams.get('category_id')
  const currentLocation = searchParams.get('location_id')

  const [assetsFolderExpanded, setAssetsFolderExpanded] = useState(false)
  const [locationsFolderExpanded, setLocationsFolderExpanded] = useState(false)

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

  const itemsOrder = ['overview', 'all-items', 'assets', 'supplies', 'locations', 'reports']

  const renderMenuItem = (key: string) => {
    switch (key) {
      case 'overview':
        return (
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all flex-1',
              pathname === '/dashboard'
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Grid className="w-4 h-4 mr-2.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">แผงควบคุม</span>
          </Link>
        )
      case 'all-items':
        return (
          <Link href="/items" className={cn('flex items-center px-2.5 py-2 rounded-lg transition-all', pathname === '/items' && !currentType && !currentCategory && !currentLocation ? 'bg-primary/10 text-primary font-bold border border-primary/20' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
            <Package className="w-4 h-4 mr-2.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">รายการทั้งหมด</span>
          </Link>
        )
      case 'supplies':
        return (
          <Link
            href="/items?type=material"
            className={cn(
              'flex items-center justify-between px-2.5 py-2 rounded-lg transition-all flex-1',
              pathname === '/items' && currentType === 'material'
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <div className="flex items-center min-w-0 flex-1">
              <Folder className="w-4 h-4 mr-2.5 text-amber-500 fill-amber-400 flex-shrink-0" />
              <span className="truncate">วัสดุ</span>
            </div>
            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {totalSuppliesCount}
            </span>
          </Link>
        )
      case 'assets':
        return (
          <div className="space-y-0.5 w-full">
            <div
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all',
                pathname === '/items' && currentType === 'asset' && !currentCategory
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <button
                  type="button"
                  aria-label="แสดงหรือซ่อนหมวดหมู่ครุภัณฑ์"
                  aria-expanded={assetsFolderExpanded}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setAssetsFolderExpanded(!assetsFolderExpanded)
                  }}
                  className="p-0.5 hover:bg-muted rounded mr-1 transition-colors flex items-center"
                >
                  {assetsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              <Link href="/items?type=asset" className="flex items-center min-w-0 flex-1">
                <Folder className="w-4 h-4 mr-2 text-amber-500 fill-amber-400 flex-shrink-0" />
                <span className="truncate">ครุภัณฑ์</span>
              </Link>
              <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {totalAssetsCount}
              </span>
            </div>

            {assetsFolderExpanded && (
              <div className="pl-6 border-l border-border ml-4 space-y-0.5">
                {categories.map((cat) => {
                  const isCurrent = currentCategory === cat.id && pathname === '/items'
                  const count = getCategoryCount(cat.id)
                  return (
                    <Link
                      key={cat.id}
                      href={`/items?type=asset&category_id=${cat.id}`}
                      className={cn(
                        'text-left py-1.5 px-2.5 rounded-md flex items-center justify-between transition-colors',
                        isCurrent
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <div className="flex items-center min-w-0">
                        {getCategoryIcon(cat.name)}
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground">{count}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      case 'locations':
        return (
          <div className="space-y-0.5 w-full">
            <div
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all',
                pathname === '/locations' && !currentLocation
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <button
                  type="button"
                  aria-label="แสดงหรือซ่อนรายการสถานที่"
                  aria-expanded={locationsFolderExpanded}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setLocationsFolderExpanded(!locationsFolderExpanded)
                  }}
                  className="p-0.5 hover:bg-muted rounded mr-1 transition-colors flex items-center"
                >
                  {locationsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              <Link href="/locations" className="flex items-center min-w-0 flex-1">
                <MapPin className="w-4 h-4 mr-2 text-rose-500 flex-shrink-0" />
                <span className="truncate">สถานที่</span>
              </Link>
              <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {locations.length}
              </span>
            </div>

            {locationsFolderExpanded && (
              <div className="pl-6 border-l border-border ml-4 space-y-0.5">
                {locations.map((loc) => {
                  const isCurrent = currentLocation === loc.id && pathname === '/items'
                  const count = getLocationCount(loc.id)
                  return (
                    <Link
                      key={loc.id}
                      href={`/items?location_id=${loc.id}`}
                      className={cn(
                        'text-left py-1.5 px-2.5 rounded-md flex items-center justify-between transition-colors',
                        isCurrent
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <span className="truncate">{loc.name}</span>
                      <span className="text-[9px] font-bold text-muted-foreground">{count}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      case 'reports':
        return (
          <Link
            href="/reports"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all flex-1',
              pathname === '/reports'
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <BarChart2 className="w-4 h-4 mr-2.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">รายงาน</span>
          </Link>
        )
      default:
        return null
    }
  }

  return (
    <aside className="relative z-30 hidden h-full w-[256px] shrink-0 flex-col border-r border-border bg-card md:flex">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white ">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold text-foreground">CAMMS Portal</div>
            <div className="truncate text-[11px] font-normal text-muted-foreground">ระบบจัดการครุภัณฑ์และวัสดุ</div>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3 border-b border-sidebar-border">


        {canWrite && (
          <NewItemDialogTrigger className="flex w-full items-center justify-center space-x-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" />
            <span>ขึ้นทะเบียนใหม่</span>
          </NewItemDialogTrigger>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 text-[13px] font-medium text-muted-foreground space-y-1">
        {itemsOrder.map((key) => {

          return (
            <div key={key} className="min-w-0">
              {(key === 'all-items' || key === 'reports') && <p className="px-2.5 pb-2 pt-5 text-[11px] font-medium text-muted-foreground">{key === 'all-items' ? 'ทะเบียนพัสดุ' : 'สรุปข้อมูล'}</p>}
              <div className="flex-1 min-w-0">
                {renderMenuItem(key)}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer Area: Settings, Trash, Profile, Logout */}
      <div className="px-2.5 pt-3 border-t border-sidebar-border bg-sidebar/30 text-xs">

        {canWrite && <p className="px-2.5 pb-2 text-[11px] font-medium text-muted-foreground">จัดการระบบ</p>}
        {/* System Settings - Admin & Staff */}
        {canWrite && (
          <Link
            href="/settings"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname === '/settings'
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Settings className="w-4 h-4 mr-2.5 text-muted-foreground" />
            <span>ตั้งค่าระบบหลัก</span>
          </Link>
        )}

        {/* User Management - Admin Only */}
        {isAdmin && (
          <Link
            href="/admin/users"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname.startsWith('/admin/users')
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <UserCog className="w-4 h-4 mr-2.5 text-muted-foreground" />
            <span>จัดการผู้ใช้งาน</span>
          </Link>
        )}

        {/* Audit Logs Explorer - Admin Only */}
        {isAdmin && (
          <Link
            href="/admin/audit-logs"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname.startsWith('/admin/audit-logs')
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <History className="w-4 h-4 mr-2.5 text-muted-foreground" />
            <span>ประวัติการทำรายการ (Audit Logs)</span>
          </Link>
        )}

        {/* Database Panel - Admin Only */}
        {isAdmin && (
          <Link
            href="/admin/db-panel"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname.startsWith('/admin/db-panel')
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Database className="w-4 h-4 mr-2.5 text-muted-foreground" />
            <span>จัดการฐานข้อมูล (DB Admin)</span>
          </Link>
        )}
      </div>

      <div className="border-t border-sidebar-border bg-sidebar/50 p-2 mt-auto">
        {profile && (
          <Link
            href="/profile"
            className={cn(
              'mb-2 flex items-center gap-2 rounded-lg border border-border p-2 transition-all group',
              pathname === '/profile'
                ? 'bg-blue-50/80 border-blue-200 shadow-xs'
                : 'bg-card hover:bg-sidebar-accent hover:border-sidebar-border'
            )}
            title="ตั้งค่าบัญชีส่วนบุคคล"
          >
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
              pathname === '/profile'
                ? 'border-blue-200 bg-blue-600 text-white'
                : 'border-border bg-muted text-muted-foreground group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200'
            )}>
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                'truncate text-xs font-bold leading-none transition-colors',
                pathname === '/profile' ? 'text-blue-700' : 'text-foreground group-hover:text-blue-600'
              )}>
                {profile.display_name?.trim() || profile.full_name}
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold text-blue-600">
                {roleLabels[profile.role] ?? profile.role}
              </p>
            </div>
          </Link>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>ออกจากระบบ</span>
          </button>
        </form>
      </div>

    </aside>
  )
}
