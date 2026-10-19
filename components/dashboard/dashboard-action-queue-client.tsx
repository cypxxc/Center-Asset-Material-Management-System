'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Hammer,
  Package,
  MapPin,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import type { UrgentDamagedItem } from '@/features/items/types'

export interface FormattedLowStockItem {
  id: string
  item_name: string
  quantity: number
  locationName: string
  unit_name?: string | null
}

export interface DashboardActionQueueClientProps {
  damagedItems: UrgentDamagedItem[]
  lowStockItems: FormattedLowStockItem[]
}

export function DashboardActionQueueClient({
  damagedItems,
  lowStockItems,
}: DashboardActionQueueClientProps) {
  const [activeTab, setActiveTab] = useState<'damaged' | 'low-stock'>('damaged')

  const totalUrgent = damagedItems.length + lowStockItems.length

  return (
    <div
      id="action-queue"
      className="bg-card text-card-foreground p-5 sm:p-6 rounded-xl border border-border shadow-2xs flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-card-foreground">
            คิวงานและรายการที่ต้องดำเนินการ
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            รายการพัสดุชำรุดรอส่งซ่อมและวัสดุที่ต้องเติมสต็อกเร่งด่วน
          </p>
        </div>

        <div>
          {totalUrgent === 0 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>คิวงานเรียบร้อย</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
              <AlertTriangle className="size-3.5 text-rose-500" />
              <span className="tabular-nums tracking-tight">ต้องดำเนินการ {totalUrgent} รายการ</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="คิวงานที่ต้องดำเนินการ"
        className="flex border-b border-border mt-3 mb-4 gap-2"
      >
        <button
          type="button"
          role="tab"
          id="tab-damaged"
          aria-selected={activeTab === 'damaged'}
          aria-controls="panel-damaged"
          onClick={() => setActiveTab('damaged')}
          className={`flex items-center gap-2 px-3 py-2.5 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'damaged'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Hammer className="size-4" />
          <span>พัสดุชำรุดและรอซ่อม</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums tracking-tight ${
              damagedItems.length > 0
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {damagedItems.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-low-stock"
          aria-selected={activeTab === 'low-stock'}
          aria-controls="panel-low-stock"
          onClick={() => setActiveTab('low-stock')}
          className={`flex items-center gap-2 px-3 py-2.5 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'low-stock'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="size-4" />
          <span>วัสดุใกล้หมดคลัง</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums tracking-tight ${
              lowStockItems.length > 0
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {lowStockItems.length}
          </span>
        </button>
      </div>

      {/* Tab 1 Panel: Damaged & Repair Queue */}
      {activeTab === 'damaged' && (
        <div
          id="panel-damaged"
          role="tabpanel"
          aria-labelledby="tab-damaged"
          className="space-y-2.5"
        >
          {damagedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2.5 text-muted-foreground">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                ไม่มีพัสดุชำรุดหรือรอซ่อมในขณะนี้ อุปกรณ์ทั้งหมดอยู่ในสภาพพร้อมใช้งาน
              </p>
            </div>
          ) : (
            damagedItems.map((item) => {
              const isWaitingRepair = item.status === 'waiting_repair'
              return (
                <div
                  key={item.id}
                  className="bg-card hover:bg-muted/40 border border-border/80 p-3 sm:p-3.5 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail: 40x40px */}
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.item_name}
                        className="w-10 h-10 rounded-lg object-cover border border-border/70 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                          isWaitingRepair
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <Hammer className="size-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-card-foreground truncate">
                        {item.item_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-xs text-muted-foreground">
                        {item.asset_no && (
                          <span className="font-mono tabular-nums tracking-tight font-medium text-foreground/80 bg-muted px-1.5 py-0.5 rounded text-[11px]">
                            {item.asset_no}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">
                            {item.locationName || 'ไม่มีระบุสถานที่'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Status badge: Text + Icon + Color */}
                    {isWaitingRepair ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        <Hammer className="size-3" />
                        <span>รอส่งซ่อม</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                        <AlertTriangle className="size-3" />
                        <span>ชำรุด</span>
                      </span>
                    )}

                    <Link
                      href={`/items/${item.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-card-foreground transition-colors"
                    >
                      <span>ดูข้อมูล</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab 2 Panel: Low Stock Monitor */}
      {activeTab === 'low-stock' && (
        <div
          id="panel-low-stock"
          role="tabpanel"
          aria-labelledby="tab-low-stock"
          className="space-y-2.5"
        >
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2.5 text-muted-foreground">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                ระดับวัสดุคงคลังทั้งหมดอยู่ในเกณฑ์ปกติ
              </p>
            </div>
          ) : (
            lowStockItems.map((item) => (
              <div
                key={item.id}
                className="bg-card hover:bg-muted/40 border border-border/80 p-3 sm:p-3.5 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Package className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-card-foreground truncate">
                      {item.item_name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                      <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                      <span className="truncate max-w-[160px] sm:max-w-[220px]">
                        {item.locationName || 'ไม่มีระบุสถานที่'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums tracking-tight">
                      {item.quantity} {item.unit_name || 'ชิ้น'}
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 mt-0.5">
                      <AlertTriangle className="size-3" />
                      <span>ต่ำกว่าเกณฑ์</span>
                    </span>
                  </div>

                  <Link
                    href={`/items/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-card-foreground transition-colors"
                  >
                    <span>ดูข้อมูล</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
