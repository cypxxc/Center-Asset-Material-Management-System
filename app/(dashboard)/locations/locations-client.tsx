'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  ExternalLink,
  MapPin,
  Package,
  FileText,
  Folder,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'

const typeIcons: Record<string, React.ReactNode> = {
  asset: <Package className="w-4 h-4 text-blue-600" />,
  material: <FileText className="w-4 h-4 text-emerald-600" />,
}

interface LocationItem {
  id: string
  name: string
  type: string
  qty: number
  categoryName: string
  locationId: string | null
  locationName: string
  status: string
  serialNumber: string
}

interface LocationRow {
  id: string
  name: string
  building: string | null
  floor: string | null
  room: string | null
}

interface LocationsClientProps {
  locations: LocationRow[]
  items: LocationItem[]
}

export function LocationsClient({ locations, items }: LocationsClientProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations[0]?.id || null
  )
  const [searchQuery, setSearchQuery] = useState('')

  const getItemsInLocation = (locationId: string) => {
    return items.filter((item) => item.locationId === locationId)
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null
  const selectedLocationItems = selectedLocation
    ? getItemsInLocation(selectedLocation.id).filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="สำรวจตำแหน่งจัดเก็บ (Locations)"
        subtitle="ตรวจสอบ ตรวจนับ และค้นหาสิ่งของระหว่างแผนกสำนักงานต่างๆ"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Locations List */}
        <div className="lg:col-span-1 space-y-3">
          {locations.map((loc) => {
            const locItems = getItemsInLocation(loc.id)
            const isSelected = selectedLocationId === loc.id
            const totalQty = locItems.reduce((sum, item) => sum + item.qty, 0)

            return (
              <Button
                key={loc.id}
                asChild
              >
                <button
                  onClick={() => setSelectedLocationId(isSelected ? null : loc.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer h-auto shrink-0 select-none font-normal bg-clip-padding',
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/10 hover:bg-blue-700'
                      : 'bg-white text-slate-800 border-slate-100 hover:border-slate-200 shadow-sm hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                      )}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{loc.name}</p>
                      <p className={cn('text-[11px] mt-0.5', isSelected ? 'text-blue-100' : 'text-slate-400')}>
                        มีอุปกรณ์ {locItems.length} รายการ ({totalQty} ชิ้น)
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 transition-transform',
                      isSelected ? 'rotate-90 text-white' : 'text-slate-400'
                    )}
                  />
                </button>
              </Button>
            )
          })}
          {locations.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">ไม่พบข้อมูลสถานที่</p>
          )}
        </div>

        {/* Right Pane: Selected Location Items */}
        <div className="lg:col-span-2">
          {selectedLocation ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              {/* Selected Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span>สิ่งของทั้งหมดที่ตั้งอยู่ที่: {selectedLocation.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    แสดงรายการเครื่องมือ อุปกรณ์ และวัสดุที่ผู้รับผิดชอบดูแลอยู่ที่สถานที่นี้
                  </p>
                </div>
                <span className="bg-blue-600 font-bold px-2.5 py-1 rounded-full text-xs">
                  {getItemsInLocation(selectedLocation.id).length} รายการ
                </span>
              </div>

              {/* Search bar inside selected location */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <SearchInput
                  value={searchQuery}
                  onChange={(val) => setSearchQuery(val)}
                  placeholder="ค้นหาสิ่งของในแผนกนี้..."
                  className="w-full max-w-full"
                />
              </div>

              {/* Item Cards List */}
              <div className="p-4 space-y-2.5 max-h-[500px] overflow-y-auto">
                {selectedLocationItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white hover:bg-slate-50/50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {typeIcons[item.type] || <Folder className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate pr-2">{item.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          S/N: {item.serialNumber} | {item.categoryName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-black text-slate-800">{item.qty} ชิ้น</span>
                      <StatusBadge status={item.status} />
                      <Link
                        href={`/items/${item.id}`}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        title="เปิดหน้ารายละเอียดเต็ม"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}

                {selectedLocationItems.length === 0 && (
                  <EmptyState
                    title="ไม่พบสิ่งของในแผนกนี้"
                    description="ลองล้างคำค้นหาหรือขึ้นทะเบียนสิ่งของใหม่สำหรับตำแหน่งนี้"
                    className="py-12 border-0 shadow-none bg-transparent"
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<MapPin className="w-10 h-10 mx-auto text-slate-300 animate-bounce" />}
              title="เลือกสถานที่เพื่อดูรายการสิ่งของ"
              description="คลิกเลือกแผนกหรือห้องสำนักงานในแถบซ้ายมือเพื่อตรวจสอบรายละเอียดสิ่งของภายในห้องนั้น"
            />
          )}
        </div>
      </div>
    </PageContainer>
  )
}
