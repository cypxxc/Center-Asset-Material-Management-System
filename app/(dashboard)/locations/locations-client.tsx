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
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { AssetTagModal, type ItemStickerData } from '@/components/ui/asset-tag-modal'

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
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false)

  const getItemsInLocation = (locationId: string) => {
    return items.filter((item) => item.locationId === locationId)
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null
  const selectedLocationRawItems = selectedLocation ? getItemsInLocation(selectedLocation.id) : []
  const selectedLocationItems = selectedLocation
    ? selectedLocationRawItems.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const locationStickerItems: ItemStickerData[] = selectedLocationRawItems.map((itm) => ({
    id: itm.id,
    item_name: itm.name,
    asset_no: itm.serialNumber && itm.serialNumber !== '-' ? itm.serialNumber : undefined,
    serial_no: itm.serialNumber && itm.serialNumber !== '-' ? itm.serialNumber : undefined,
    location_name: itm.locationName,
    category_name: itm.categoryName,
  }))

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="สถานที่จัดเก็บ"
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
                <button
                  key={loc.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedLocationId(isSelected ? null : loc.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border transition-colors flex items-center justify-between gap-3 cursor-pointer h-auto shrink-0 select-none font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isSelected
                      ? 'bg-blue-50 text-blue-950 border-blue-300 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-50 dark:border-blue-700 dark:hover:bg-blue-900'
                      : 'bg-card text-foreground border-border hover:border-border shadow-sm hover:bg-muted'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        'shrink-0 p-2 rounded-lg',
                        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      )}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-sm">{loc.name}</p>
                      <p className={cn('text-xs mt-1', isSelected ? 'text-blue-800 dark:text-blue-200' : 'text-muted-foreground')}>
                        มีอุปกรณ์ {locItems.length} รายการ ({totalQty} ชิ้น)
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform motion-reduce:transition-none',
                      isSelected ? 'rotate-90 text-blue-700 dark:text-blue-200' : 'text-muted-foreground'
                    )}
                  />
                </button>
            )
          })}
          {locations.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">ไม่พบข้อมูลสถานที่</p>
          )}
        </div>

        {/* Right Pane: Selected Location Items */}
        <div className="lg:col-span-2">
          {selectedLocation ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
              {/* Selected Header */}
              <div className="p-5 bg-muted text-foreground flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span>สิ่งของทั้งหมดที่ตั้งอยู่ที่: {selectedLocation.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    แสดงรายการเครื่องมือ อุปกรณ์ และวัสดุที่ผู้รับผิดชอบดูแลอยู่ที่สถานที่นี้
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchPrintModalOpen(true)}
                    disabled={locationStickerItems.length === 0}
                    className="h-8 px-2.5 text-xs font-semibold flex items-center gap-1.5 border-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    title="พิมพ์ป้ายลาเบลสิ่งของทั้งหมดในสถานที่นี้"
                  >
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>พิมพ์ป้ายทั้งสถานที่ ({locationStickerItems.length} ชิ้น)</span>
                  </Button>
                  <span className="bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full text-xs">
                    {selectedLocationRawItems.length} รายการ
                  </span>
                </div>
              </div>

              {/* Search bar inside selected location */}
              <div className="p-4 border-b border-border bg-muted/50">
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
                    className="p-3 bg-card hover:bg-muted/50 border border-border hover:border-border rounded-xl transition-all flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {typeIcons[item.type] || <Folder className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate pr-2">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          S/N: {item.serialNumber} | {item.categoryName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-black text-foreground">{item.qty} ชิ้น</span>
                      <StatusBadge status={item.status} />
                      <Link
                        href={`/items/${item.id}`}
                        className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
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
              icon={<MapPin className="w-10 h-10 mx-auto text-slate-300" />}
              title="เลือกสถานที่เพื่อดูรายการสิ่งของ"
              description="เลือกรายการแผนกหรือห้องสำนักงานจากแถบด้านซ้ายเพื่อดูรายละเอียดสิ่งของภายในพื้นที่"
            />
          )}
        </div>
      </div>

      <AssetTagModal
        isOpen={isBatchPrintModalOpen}
        onClose={() => setIsBatchPrintModalOpen(false)}
        items={locationStickerItems}
      />
    </PageContainer>
  )
}
