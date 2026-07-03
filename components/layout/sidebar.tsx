'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Archive,
  Armchair,
  BarChart2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Grid,
  Laptop,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  Trash,
  User,
  Database,
  GripVertical,
} from 'lucide-react'
import { signOut, updateSidebarOrder } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

interface SidebarProps {
  profile: {
    full_name: string
    email: string
    role: string
    sidebar_order?: string[] | null
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
    return <Laptop className="h-3.5 w-3.5 mr-2 text-slate-400" />
  }
  if (
    n.includes('โต๊ะ') ||
    n.includes('เก้าอี้') ||
    n.includes('เฟอร์') ||
    n.includes('furn') ||
    n.includes('chair')
  ) {
    return <Armchair className="h-3.5 w-3.5 mr-2 text-slate-400" />
  }
  return <FileText className="h-3.5 w-3.5 mr-2 text-slate-400" />
}

export function Sidebar({ profile, sidebarData }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type')
  const currentCategory = searchParams.get('category_id')
  const currentLocation = searchParams.get('location_id')
  const currentStatus = searchParams.get('status')
  const currentDeleted = searchParams.get('deleted')

  const [assetsFolderExpanded, setAssetsFolderExpanded] = useState(true)
  const [locationsFolderExpanded, setLocationsFolderExpanded] = useState(true)

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
  const archiveCount = counts.archive_count
  const trashCount = counts.trash_count

  const getCategoryCount = (catId: string) => {
    return categories.find((c) => c.id === catId)?.count ?? 0
  }

  const getLocationCount = (locId: string) => {
    return locations.find((l) => l.id === locId)?.count ?? 0
  }

  const isAdmin = profile?.role === 'admin'
  const isStaff = profile?.role === 'staff'
  const canWrite = isAdmin || isStaff

  const [itemsOrder, setItemsOrder] = useState<string[]>(() => {
    if (profile?.sidebar_order && Array.isArray(profile.sidebar_order) && profile.sidebar_order.length === 5) {
      return profile.sidebar_order
    }
    return ['overview', 'supplies', 'assets', 'locations', 'reports']
  })
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', index.toString())
    }
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      handleDragEnd()
      return
    }

    const newOrder = [...itemsOrder]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(dragOverIndex, 0, draggedItem)

    // Optimistic state update
    setItemsOrder(newOrder)
    handleDragEnd()

    try {
      const res = await updateSidebarOrder(newOrder)
      if (res.error) {
        // Order save failed — UI reverts on next navigation refresh
      }
    } catch {
      // Non-blocking: sidebar order persists locally until next successful save
    }
  }

  const renderMenuItem = (key: string) => {
    switch (key) {
      case 'overview':
        return (
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all flex-1',
              pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                : 'hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <Grid className="w-4 h-4 mr-2.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">Overview Console</span>
          </Link>
        )
      case 'supplies':
        return (
          <Link
            href="/items?type=material"
            className={cn(
              'flex items-center justify-between px-2.5 py-2 rounded-lg transition-all flex-1',
              pathname === '/items' && currentType === 'material'
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                : 'hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <div className="flex items-center min-w-0 flex-1">
              <Folder className="w-4 h-4 mr-2.5 text-amber-500 fill-amber-400 flex-shrink-0" />
              <span className="truncate">Supplies (วัสดุสิ้นเปลือง)</span>
            </div>
            <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
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
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                  : 'hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <Link href="/items?type=asset" className="flex items-center min-w-0 flex-1">
                <span
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setAssetsFolderExpanded(!assetsFolderExpanded)
                  }}
                  className="p-0.5 hover:bg-slate-200/50 rounded mr-1 transition-colors flex items-center"
                >
                  {assetsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
                <Folder className="w-4 h-4 mr-2 text-amber-500 fill-amber-400 flex-shrink-0" />
                <span className="truncate">Assets (ครุภัณฑ์)</span>
              </Link>
              <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {totalAssetsCount}
              </span>
            </div>

            {assetsFolderExpanded && (
              <div className="pl-6 border-l border-slate-200 ml-4 space-y-0.5">
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
                          ? 'bg-blue-100/60 text-blue-700 font-bold'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      )}
                    >
                      <div className="flex items-center min-w-0">
                        {getCategoryIcon(cat.name)}
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{count}</span>
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
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                  : 'hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <Link href="/locations" className="flex items-center min-w-0 flex-1">
                <span
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setLocationsFolderExpanded(!locationsFolderExpanded)
                  }}
                  className="p-0.5 hover:bg-slate-200/50 rounded mr-1 transition-colors flex items-center"
                >
                  {locationsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
                <MapPin className="w-4 h-4 mr-2 text-rose-500 flex-shrink-0" />
                <span className="truncate">Locations (สถานที่ตั้ง)</span>
              </Link>
              <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {locations.length}
              </span>
            </div>

            {locationsFolderExpanded && (
              <div className="pl-6 border-l border-slate-200 ml-4 space-y-0.5">
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
                          ? 'bg-blue-100/60 text-blue-700 font-bold'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      )}
                    >
                      <span className="truncate">{loc.name}</span>
                      <span className="text-[9px] font-bold text-slate-400">{count}</span>
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
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                : 'hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <BarChart2 className="w-4 h-4 mr-2.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">Reports & Analytics</span>
          </Link>
        )
      default:
        return null
    }
  }

  return (
    <aside className="relative z-30 hidden h-full w-[260px] shrink-0 select-none flex-col border-r border-slate-200 bg-white md:flex">
      {/* Brand Header */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold text-slate-800">CAMMS</div>
            <div className="truncate text-[9px] font-semibold text-slate-400">Asset & Material Management</div>
          </div>
        </Link>
      </div>

      {/* Directory tree explorer view */}
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
          <span>Directory Tree</span>
        </h2>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inventory File System</p>
        
        {canWrite && (
          <Link
            href="/items?new=true"
            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-blue-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ขึ้นทะเบียนใหม่</span>
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 text-xs font-medium text-slate-600 space-y-1">
        {itemsOrder.map((key, index) => {
          const isDragged = draggedIndex === index
          const isOver = dragOverIndex === index

          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              className={cn(
                'group relative flex items-start gap-1 rounded-lg transition-all duration-200 border border-transparent',
                isDragged && 'opacity-40 border-dashed border-slate-300 bg-slate-50',
                isOver && 'border-blue-400 bg-blue-50/30 scale-[1.01] shadow-sm',
                !isDragged && !isOver && 'hover:bg-slate-50/50'
              )}
            >
              {/* Drag Handle - Grip icon visible on hover */}
              <div 
                className="flex items-center justify-center self-center cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 shrink-0 select-none"
                title="ลากเพื่อย้ายตำแหน่ง"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                {renderMenuItem(key)}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer Area: Settings, Archive, Trash, Profile, Logout */}
      <div className="px-2.5 pt-3 border-t border-slate-200 bg-slate-50/30 text-xs">
        {/* Archive Link */}
        <Link
          href="/items?status=archive"
          className={cn(
            'flex items-center justify-between px-2.5 py-2 rounded-lg transition-all',
            pathname === '/items' && currentStatus === 'archive'
              ? 'bg-slate-100 text-slate-800 font-bold'
              : 'text-slate-500 hover:bg-slate-50'
          )}
        >
          <div className="flex items-center">
            <Archive className="w-4 h-4 mr-2.5 text-slate-400" />
            <span>Archive</span>
          </div>
          <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
            {archiveCount}
          </span>
        </Link>

        {/* Trash Link (Soft-deleted items) - Visible for Admins and Staff */}
        {canWrite && (
          <Link
            href="/items?deleted=true"
            className={cn(
              'flex items-center justify-between px-2.5 py-2 rounded-lg transition-all',
              pathname === '/items' && currentDeleted === 'true'
                ? 'bg-red-50 text-red-700 font-bold'
                : 'text-slate-500 hover:bg-red-50 hover:text-red-600'
            )}
          >
            <div className="flex items-center">
              <Trash className="w-4 h-4 mr-2.5 text-red-400" />
              <span>Trash (ถังขยะ)</span>
            </div>
            <span className="text-[10px] font-bold bg-red-100 px-1.5 py-0.5 rounded text-red-500">
              {trashCount}
            </span>
          </Link>
        )}

        {/* System Settings - Admin & Staff */}
        {canWrite && (
          <Link
            href="/settings"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname === '/settings'
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <Settings className="w-4 h-4 mr-2.5 text-slate-400" />
            <span>ตั้งค่าระบบหลัก</span>
          </Link>
        )}

        {/* Database Panel - Admin Only */}
        {isAdmin && (
          <Link
            href="/admin/db-panel"
            className={cn(
              'flex items-center px-2.5 py-2 rounded-lg transition-all',
              pathname.startsWith('/admin/db-panel')
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <Database className="w-4 h-4 mr-2.5 text-slate-400" />
            <span>จัดการฐานข้อมูล (DB Admin)</span>
          </Link>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 p-2 mt-auto">
        {profile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
              <User className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-none text-slate-800">{profile.full_name}</p>
              <p className="mt-1 truncate text-[10px] font-semibold text-blue-600">
                {roleLabels[profile.role] ?? profile.role}
              </p>
            </div>
          </div>
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
