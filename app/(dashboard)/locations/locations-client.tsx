'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  ExternalLink,
  Laptop,
  MapPin,
  Package,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  spare: 'bg-blue-100 text-blue-700 border-blue-200',
  damaged: 'bg-rose-100 text-rose-700 border-rose-200',
  waiting_repair: 'bg-amber-100 text-amber-700 border-amber-200',
  inactive: 'bg-slate-100 text-slate-700 border-slate-200',
  disposed: 'bg-red-100 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  active: 'ใช้งานอยู่',
  spare: 'สำรอง',
  damaged: 'ชำรุด',
  waiting_repair: 'รอซ่อม',
  inactive: 'ไม่ใช้งาน',
  disposed: 'จำหน่ายแล้ว',
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
    <div className="h-full overflow-y-auto bg-slate-50/50 p-6 md:p-8 font-sans text-slate-800">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">สำรวจตำแหน่งจัดเก็บ (Locations)</h2>
        <p className="text-xs text-slate-400">ตรวจสอบ ตรวจนับ และค้นหาสิ่งของระหว่างแผนกสำนักงานต่างๆ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Locations List */}
        <div className="lg:col-span-1 space-y-3">
          {locations.map((loc) => {
            const locItems = getItemsInLocation(loc.id)
            const isSelected = selectedLocationId === loc.id
            const totalQty = locItems.reduce((sum, item) => sum + item.qty, 0)

            return (
              <button
                key={loc.id}
                onClick={() => setSelectedLocationId(isSelected ? null : loc.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer',
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/10'
                    : 'bg-white text-slate-800 border-slate-100 hover:border-slate-200 shadow-sm'
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
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาสิ่งของในแผนกนี้..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
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
                        {item.type === 'asset' ? (
                          <Package className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Laptop className="w-4 h-4 text-emerald-600" />
                        )}
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
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
                          statusBadgeClasses[item.status] || 'border-slate-200 bg-slate-50 text-slate-700'
                        )}
                      >
                        {statusLabels[item.status] || item.status}
                      </span>
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
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-bold">ไม่พบสิ่งของในแผนกนี้</p>
                    <p className="text-xs mt-1">ลองล้างคำค้นหาหรือขึ้นทะเบียนสิ่งของใหม่สำหรับตำแหน่งนี้</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 bg-white rounded-2xl p-16 text-center text-slate-400">
              <MapPin className="w-10 h-10 mx-auto text-slate-300 animate-bounce" />
              <h4 className="font-bold text-slate-700 mt-3 text-sm">เลือกสถานที่เพื่อดูรายการสิ่งของ</h4>
              <p className="text-xs max-w-xs mx-auto mt-1 leading-relaxed">
                คลิกเลือกแผนกหรือห้องสำนักงานในแถบซ้ายมือเพื่อตรวจสอบรายละเอียดสิ่งของภายในห้องนั้น
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
