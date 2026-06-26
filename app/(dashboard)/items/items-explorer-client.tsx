'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  MapPin, 
  User, 
  Copy, 
  CheckCircle,
  FileText,
  ChevronRight,
  ExternalLink,
  Tag,
  Hash,
  StickyNote
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, ItemListRow } from '@/features/items/types'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { cn } from '@/lib/utils'

interface ItemsExplorerClientProps {
  items: ItemListRow[]
  total: number
  page: number
  totalPages: number
  params: { q?: string; type?: string; status?: string; page?: string }
  userCanWrite: boolean
  userCanDelete: boolean
}

export function ItemsExplorerClient({
  items,
  total,
  page,
  totalPages,
  params,
  userCanWrite,
  userCanDelete
}: ItemsExplorerClientProps) {
  const router = useRouter()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Sync selected item when items list updates
  useEffect(() => {
    if (items.length > 0) {
      if (!selectedItemId || !items.some(item => item.id === selectedItemId)) {
        setSelectedItemId(items[0].id)
      }
    } else {
      setSelectedItemId(null)
    }
  }, [items])

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2000)
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    triggerToast(`คัดลอกรหัส "${text}" ไปยังคลิปบอร์ดแล้ว!`)
  }

  const getRelativeAuditedTime = (dateStr?: string): string => {
    if (!dateStr) return 'ยังไม่ได้ตรวจสอบ'
    const auditDate = new Date(dateStr)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - auditDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 0) return 'วันนี้'
    if (diffDays === 1) return 'เมื่อวานนี้'
    if (diffDays > 30) return `${Math.floor(diffDays / 30)} เดือนที่แล้ว`
    return `${diffDays} วันที่ผ่านมา`
  }

  const getItemIcon = (categoryName?: string) => {
    const cat = (categoryName || '').toLowerCase()
    if (cat.includes('it') || cat.includes('tech') || cat.includes('คอม') || cat.includes('ไอที')) {
      return (
        <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-sm">
          💻
        </div>
      )
    }
    if (cat.includes('โต๊ะ') || cat.includes('เก้าอี้') || cat.includes('เฟอร์') || cat.includes('furniture')) {
      return (
        <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-sm">
          🪑
        </div>
      )
    }
    if (cat.includes('กล้อง') || cat.includes('เครื่องเสียง') || cat.includes('av') || cat.includes('projector')) {
      return (
        <div className="w-8 h-8 rounded bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-sm">
          📹
        </div>
      )
    }
    return (
      <div className="w-8 h-8 rounded bg-slate-50 text-slate-600 flex items-center justify-center font-bold shadow-sm">
        📦
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    let classes = 'text-slate-700 bg-slate-50 border-slate-200'
    if (status === 'active') classes = 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (status === 'spare') classes = 'text-blue-700 bg-blue-50 border-blue-200'
    if (status === 'damaged') classes = 'text-rose-700 bg-rose-50 border-rose-200'
    if (status === 'waiting_repair') classes = 'text-amber-700 bg-amber-50 border-amber-200'
    if (status === 'inactive') classes = 'text-slate-700 bg-slate-50 border-slate-200'
    if (status === 'disposed') classes = 'text-red-700 bg-red-50 border-red-200'

    const label = ITEM_STATUS_LABELS[status as keyof typeof ITEM_STATUS_LABELS] || status

    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border', classes)}>
        <span className="w-1.2 h-1.2 rounded-full bg-current mr-1.5 animate-pulse"></span>
        {label}
      </span>
    )
  }

  const inspectedItem = items.find(item => item.id === selectedItemId)

  const buildPageHref = (pageNumber: number) => {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.type) query.set('type', params.type)
    if (params.status) query.set('status', params.status)
    query.set('page', String(pageNumber))
    return `/items?${query.toString()}`
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f0f4f8] font-sans relative">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main 3-Column Split Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left pane: Explorer view */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Toolbar and filter actions */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">ทะเบียนสิ่งของสำนักงาน</h2>
              <p className="text-xs text-slate-500">ดู แก้ไข และจัดการทะเบียนครุภัณฑ์ในโหมด Explorer</p>
            </div>
            
            <div className="flex items-center gap-2">
              {userCanWrite && (
                <Link href="/items/new">
                  <Button className="font-semibold flex items-center gap-1.5 h-9 text-xs shadow-sm cursor-pointer rounded-lg bg-primary">
                    <Plus className="h-4 w-4" />
                    <span>ขึ้นทะเบียนใหม่</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Search bar inside toolbar */}
          <div className="px-6 py-3 border-b border-slate-100 flex flex-shrink-0 bg-white">
            <form action="/items" method="GET" className="w-full flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="ค้นหาด้วยชื่อ, เลขครุภัณฑ์, Serial, ผู้รับผิดชอบ..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              <select 
                name="type" 
                defaultValue={params.type ?? ''} 
                className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">ทุกประเภท</option>
                {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select 
                name="status" 
                defaultValue={params.status ?? ''} 
                className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">ทุกสถานะ</option>
                {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <Button type="submit" variant="outline" className="h-9 px-4 text-xs font-bold cursor-pointer rounded-lg">
                กรองข้อมูล
              </Button>
            </form>
          </div>

          {/* Table list */}
          <div className="flex-grow overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 w-10"></th> {/* Icon column */}
                  <th className="px-5 py-3 pl-2">ชื่อสิ่งของ / รหัสครุภัณฑ์</th>
                  <th className="px-5 py-3 hidden sm:table-cell">ประเภท</th>
                  <th className="px-5 py-3 hidden md:table-cell">หมวดหมู่</th>
                  <th className="px-5 py-3 text-center">จำนวน</th>
                  <th className="px-5 py-3">สถานที่ตั้ง</th>
                  <th className="px-5 py-3 hidden lg:table-cell">ผู้รับผิดชอบ</th>
                  <th className="px-5 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isSelected = selectedItemId === item.id
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        setSelectedItemId(item.id)
                        // On mobile, clicking a row directly routes to details page
                        if (window.innerWidth < 1024) {
                          router.push(`/items/${item.id}`)
                        }
                      }}
                      className={cn(
                        'cursor-pointer transition-all duration-150',
                        isSelected 
                          ? 'bg-blue-50/70 text-slate-900 border-l-2 border-l-blue-600 font-semibold' 
                          : 'hover:bg-slate-50/50 text-slate-600'
                      )}
                    >
                      <td className="px-5 py-3 text-center">
                        {getItemIcon(item.category?.name)}
                      </td>
                      <td className="px-5 py-3 pl-2">
                        <div className="font-bold text-slate-800">{item.item_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {item.asset_no || item.serial_no || '- ไม่มีเลขอ้างอิง -'}
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell font-medium">
                        {ITEM_TYPE_LABELS[item.item_type]}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {item.category?.name ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-slate-800">
                        {item.quantity} {item.unit?.name ?? ''}
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-medium">
                        {item.location?.name ?? '-'}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell font-semibold">
                        {item.responsible_person ?? '-'}
                      </td>
                      <td className="px-5 py-3">
                        {getStatusBadge(item.status)}
                      </td>
                    </tr>
                  )
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                      ไม่พบข้อมูลสิ่งของพัสดุในทะเบียน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer pagination */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 flex-shrink-0">
            <div>ทั้งหมด {total} รายการ · หน้า {page} / {totalPages}</div>
            <div className="flex items-center gap-2">
              <Link href={buildPageHref(Math.max(1, page - 1))}>
                <Button variant="outline" disabled={page <= 1} className="h-8 text-xs cursor-pointer rounded-lg">
                  ก่อนหน้า
                </Button>
              </Link>
              <Link href={buildPageHref(Math.min(totalPages, page + 1))}>
                <Button variant="outline" disabled={page >= totalPages} className="h-8 text-xs cursor-pointer rounded-lg">
                  ถัดไป
                </Button>
              </Link>
            </div>
          </div>

        </div>

        {/* Right pane: Inspector (Desktop only) */}
        {inspectedItem && (
          <aside className="hidden lg:block w-[320px] xl:w-[360px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 overflow-y-auto shadow-sm z-10">
            {/* Header Image Cover */}
            <div className="h-48 bg-slate-100 relative group overflow-hidden border-b border-slate-100">
              {inspectedItem.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={inspectedItem.image_url} 
                  alt={inspectedItem.item_name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1.5">
                  <Package className="w-12 h-12 stroke-[1.25]" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">No Image Available</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <Link 
                href={`/items/${inspectedItem.id}`}
                className="absolute top-3 right-3 p-2 bg-white/95 hover:bg-white text-blue-600 rounded-full shadow-md backdrop-blur-sm transform hover:scale-105 transition-all"
                title="เปิดหน้ารายละเอียดเต็มจอ"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            <div className="p-5 flex-grow flex flex-col bg-gradient-to-b from-white to-slate-50/30 gap-5">
              
              {/* Primary Header Card */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start gap-1">
                  <h3 className="font-extrabold text-base text-slate-800 leading-tight">
                    {inspectedItem.item_name}
                  </h3>
                  <div className="flex-shrink-0">
                    {getStatusBadge(inspectedItem.status)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 mt-3.5">
                  <span className="bg-slate-100 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded text-[10px] font-bold">
                    {inspectedItem.category?.name || 'หมวดหมู่ทั่วไป'}
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                    {ITEM_TYPE_LABELS[inspectedItem.item_type]}
                  </span>
                </div>
              </div>

              {/* Data Specifications List */}
              <div className="space-y-3 flex-grow">
                {/* Serial Box */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-blue-500" />
                    <span>Serial Number / เลขครุภัณฑ์</span>
                  </p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-800 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate max-w-[220px]">
                      {inspectedItem.serial_no || inspectedItem.asset_no || '-'}
                    </p>
                    <button 
                      onClick={() => handleCopyText(inspectedItem.serial_no || inspectedItem.asset_no || '')}
                      disabled={!inspectedItem.serial_no && !inspectedItem.asset_no}
                      className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition-colors disabled:opacity-40"
                      title="คัดลอกรหัสพัสดุ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Location Box */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    <span>สถานที่จัดตั้งเก็บรักษา (Location)</span>
                  </p>
                  <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {inspectedItem.location?.name || 'ไม่ได้ระบุ'}
                  </div>
                </div>

                {/* Custodian Box */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>ผู้รับผิดชอบพัสดุ (Custodian)</span>
                  </p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center text-[10px] font-bold mr-2.5 shadow-sm border border-blue-300">
                      {(inspectedItem.responsible_person || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold">{inspectedItem.responsible_person || 'ยังไม่มีผู้ลงชื่อรับ'}</span>
                  </div>
                </div>

                {/* Notes/Memos */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                    <span>หมายเหตุคำแนะนำ (Memos)</span>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                    {inspectedItem.note || '- ไม่มีหมายเหตุ -'}
                  </p>
                </div>

                {/* Last Audited date */}
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 px-1 mt-2">
                  <span>แก้ไขข้อมูลล่าสุด:</span>
                  <span>{getRelativeAuditedTime(inspectedItem.updated_at)}</span>
                </div>
              </div>

              {/* Action Buttons for Inspector */}
              {(userCanWrite || userCanDelete) && (
                <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                  <div className="flex gap-2">
                    {userCanWrite && (
                      <Link href={`/items/${inspectedItem.id}/edit`} className="flex-1">
                        <Button variant="outline" className="w-full font-bold flex items-center justify-center gap-1.5 h-10 text-xs rounded-lg cursor-pointer">
                          <Edit className="h-4 w-4" />
                          <span>แก้ไขข้อมูล</span>
                        </Button>
                      </Link>
                    )}
                    {userCanDelete && (
                      <div className="flex-1">
                        <DeleteItemButton id={inspectedItem.id} />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </aside>
        )}

      </div>
    </div>
  )
}
