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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const nextTab = activeTab === 'damaged' ? 'low-stock' : 'damaged'
      setActiveTab(nextTab)
      const targetId = nextTab === 'damaged' ? 'tab-damaged' : 'tab-low-stock'
      document.getElementById(targetId)?.focus()
    }
  }

  return (
    <div
      id="action-queue"
      className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 backdrop-blur-xs shadow-2xs flex flex-col h-full scroll-mt-6"
    >
      {/* Header */}
      <div className="px-4 py-3 sm:px-4.5 sm:py-3.5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-card-foreground flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            คิวงานและรายการที่ต้องดำเนินการ
          </h3>
          <p className="text-xs text-muted-foreground">
            รายการพัสดุชำรุดรอส่งซ่อมและพัสดุที่ต้องเติมสต็อกเร่งด่วน
          </p>
        </div>

        <div>
          {totalUrgent === 0 ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>คิวงานเรียบร้อย</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
              <AlertTriangle className="size-3.5 text-rose-500" />
              <span className="tabular-nums tracking-tight">ต้องดำเนินการ {totalUrgent} รายการ</span>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Tab Control */}
      <div className="px-4 sm:px-4.5 py-2 border-b border-border/40 bg-muted/20 flex items-center">
        <div
          role="tablist"
          aria-label="คิวงานที่ต้องดำเนินการ"
          onKeyDown={handleKeyDown}
          className="inline-flex items-center p-0.5 rounded-lg bg-muted/60 dark:bg-muted/30 border border-border/40 gap-1"
        >
          <button
            type="button"
            role="tab"
            id="tab-damaged"
            aria-selected={activeTab === 'damaged'}
            aria-controls="panel-damaged"
            onClick={() => setActiveTab('damaged')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === 'damaged'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium'
            }`}
          >
            <Hammer className="size-3.5" />
            <span>พัสดุชำรุดและรอซ่อม</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold tabular-nums tracking-tight ${
                damagedItems.length > 0
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === 'low-stock'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium'
            }`}
          >
            <Package className="size-3.5" />
            <span>พัสดุใกล้หมดคลัง</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold tabular-nums tracking-tight ${
                lowStockItems.length > 0
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {lowStockItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1 Panel: Damaged & Repair Queue */}
      {activeTab === 'damaged' && (
        <div
          id="panel-damaged"
          role="tabpanel"
          aria-labelledby="tab-damaged"
          className="flex-1 flex flex-col divide-y divide-border/30 overflow-y-auto"
        >
          {damagedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center px-4 space-y-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                ไม่มีพัสดุชำรุดหรือรอซ่อมในขณะนี้ อุปกรณ์ทั้งหมดอยู่ในสภาพพร้อมใช้งาน
              </p>
            </div>
          ) : (
            damagedItems.map((item) => {
              const isWaitingRepair = item.status === 'waiting_repair'
              return (
                <div
                  key={item.id}
                  className="px-4 py-2.5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Thumbnail */}
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.item_name}
                        className="w-8 h-8 rounded-md object-cover border border-border/70 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                          isWaitingRepair
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <Hammer className="size-3.5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">
                        {item.item_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        {item.asset_no && (
                          <span className="font-mono tabular-nums tracking-tight font-medium text-foreground/85 bg-muted/80 px-1 py-0.2 rounded text-[10.5px] border border-border/40">
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

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    {/* Status badge */}
                    {isWaitingRepair ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        <Hammer className="size-3" />
                        <span>รอส่งซ่อม</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                        <AlertTriangle className="size-3" />
                        <span>ชำรุด</span>
                      </span>
                    )}

                    <Link
                      href={`/items/${item.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border border-border/70 bg-background/80 hover:bg-muted hover:border-border text-card-foreground transition-all duration-150 shadow-2xs group-hover:border-primary/40"
                    >
                      <span>ดูข้อมูล</span>
                      <ChevronRight className="size-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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
          className="flex-1 flex flex-col divide-y divide-border/30 overflow-y-auto"
        >
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center px-4 space-y-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                ระดับพัสดุคงคลังทั้งหมดอยู่ในเกณฑ์ปกติ
              </p>
            </div>
          ) : (
            lowStockItems.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Package className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">
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

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums tracking-tight font-mono">
                      {item.quantity} {item.unit_name || 'ชิ้น'}
                    </p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 mt-0.5">
                      <AlertTriangle className="size-2.5" />
                      <span>ต่ำกว่าเกณฑ์</span>
                    </span>
                  </div>

                  <Link
                    href={`/items/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border border-border/70 bg-background/80 hover:bg-muted hover:border-border text-card-foreground transition-all duration-150 shadow-2xs group-hover:border-primary/40"
                  >
                    <span>ดูข้อมูล</span>
                    <ChevronRight className="size-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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
