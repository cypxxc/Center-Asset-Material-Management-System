'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Copy,
  Edit,
  ExternalLink,
  MapPin,
  Package,
  StickyNote,
  Tag,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { ITEM_TYPE_LABELS, type ItemListRow } from '@/features/items/types'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'
import { useMediaQuery } from '@/hooks/use-media-query'

export interface InspectorProps {
  onOpenDetails: () => void
  isOpen: boolean
  onClose: () => void
  item: ItemListRow | null
  userCanWrite: boolean
  userCanDelete: boolean
  onCopy: (value: string | null | undefined) => void
  onPrint: (item: ItemStickerData) => void
  onEdit: (item: ItemListRow) => void
  mode?: 'docked' | 'drawer' | 'auto'
}

export function Inspector({
  onOpenDetails,
  isOpen,
  onClose,
  item,
  userCanWrite,
  userCanDelete,
  onCopy,
  onPrint,
  onEdit,
  mode = 'auto',
}: InspectorProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)', false)
  const resolvedMode = mode === 'auto' ? (isDesktop ? 'docked' : 'drawer') : mode

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !item) {
    return null
  }

  const stickerData: ItemStickerData = {
    id: item.id,
    item_name: item.item_name,
    asset_no: item.asset_no,
    serial_no: item.serial_no,
    brand: item.brand,
    model: item.model,
    location_name: item.location?.name,
    category_name: item.category?.name,
    responsible_person: item.responsible_person,
    unit_price: item.unit_price,
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-5 sm:py-4 min-w-0">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">รายละเอียดสิ่งของ</span>
          <h3 className="truncate text-sm sm:text-base font-extrabold text-card-foreground" title={item.item_name}>{item.item_name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ปิดแถบรายละเอียด"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Image preview */}
        <div className="relative h-44 sm:h-52 shrink-0 overflow-hidden border-b border-border bg-muted">
          {item.image_url ? (
            <ZoomableImage
              src={item.image_url}
              alt={item.item_name}
              className="h-full w-full"
              imgClassName="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <Package className="h-12 w-12 stroke-[1.25] text-muted-foreground/50" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No Image Available</span>
            </div>
          )}

          <Link
            href={`/items/${item.id}`} onClick={onOpenDetails}
            className="absolute right-3 top-3 rounded-full bg-card/95 p-2 text-primary shadow-md transition-transform hover:scale-105 hover:bg-card"
            title="เปิดหน้ารายละเอียดเต็ม"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-3.5 p-4 sm:p-5">
          {/* Title card */}
          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h4 className="text-sm sm:text-base font-extrabold leading-tight text-card-foreground break-words min-w-0 flex-1">{item.item_name}</h4>
              <StatusBadge status={item.status} className="shrink-0" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground truncate max-w-[200px]">
                {item.category?.name || 'หมวดหมู่ทั่วไป'}
              </span>
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary shrink-0">
                {ITEM_TYPE_LABELS[item.item_type]}
              </span>
            </div>
          </div>

          {/* Asset No / Serial Number */}
          {item.asset_no && (
            <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary shrink-0" />} label="เลขครุภัณฑ์">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1" title={item.asset_no}>
                  {item.asset_no}
                </p>
                <button
                  type="button"
                  onClick={() => onCopy(item.asset_no)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
                  title="คัดลอกเลขครุภัณฑ์"
                  aria-label="คัดลอกเลขครุภัณฑ์"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </InspectorBox>
          )}

          {item.serial_no && (
            <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary shrink-0" />} label="Serial Number">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1" title={item.serial_no}>
                  {item.serial_no}
                </p>
                <button
                  type="button"
                  onClick={() => onCopy(item.serial_no)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
                  title="คัดลอก Serial Number"
                  aria-label="คัดลอก Serial Number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </InspectorBox>
          )}

          {!item.asset_no && !item.serial_no && (
            <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary shrink-0" />} label="เลขอ้างอิง">
              <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground min-w-0">
                - ไม่มีเลขอ้างอิง -
              </p>
            </InspectorBox>
          )}

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
            <InspectorBox icon={<Package className="h-3.5 w-3.5 text-primary shrink-0" />} label="จำนวนคงเหลือ">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
                {item.quantity} {item.unit?.name ?? ''}
              </div>
            </InspectorBox>

            <InspectorBox icon={<span className="material-symbols-outlined text-[15px] text-primary shrink-0">payments</span>} label="ราคาต่อหน่วย">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
                {item.unit_price !== null && item.unit_price !== undefined ? `฿${item.unit_price.toLocaleString()}` : '-'}
              </div>
            </InspectorBox>
          </div>

          {/* Location */}
          <InspectorBox icon={<MapPin className="h-3.5 w-3.5 text-primary shrink-0" />} label="สถานที่จัดเก็บ">
            <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={item.location?.name}>
              {item.location?.name || 'ไม่ได้ระบุ'}
            </div>
          </InspectorBox>

          {/* Responsible Person */}
          <InspectorBox icon={<User className="h-3.5 w-3.5 text-primary shrink-0" />} label="ผู้รับผิดชอบ">
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground min-w-0">
              <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                {(item.responsible_person || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-card-foreground truncate flex-1 min-w-0" title={item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}>
                {item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}
              </span>
            </div>
          </InspectorBox>

          {/* Brand / Model */}
          {(item.brand || item.model) && (
            <InspectorBox icon={<Package className="h-3.5 w-3.5 text-primary shrink-0" />} label="ยี่ห้อ / รุ่น">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={[item.brand, item.model].filter(Boolean).join(' - ')}>
                {[item.brand, item.model].filter(Boolean).join(' - ') || '-'}
              </div>
            </InspectorBox>
          )}

          {/* Note */}
          <InspectorBox icon={<StickyNote className="h-3.5 w-3.5 text-primary shrink-0" />} label="หมายเหตุ">
            <p className="max-h-24 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs leading-relaxed text-muted-foreground break-words min-w-0">
              {item.note || '- ไม่มีหมายเหตุ -'}
            </p>
          </InspectorBox>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 border-t border-border bg-card p-3 sm:p-4 min-w-0">
        <div className="flex flex-col gap-2 w-full min-w-0">
          <div className="grid grid-cols-2 gap-2 min-w-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrint(stickerData)}
              className="h-9 sm:h-10 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 px-2 min-w-0"
            >
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">พิมพ์ป้ายบาร์โค้ด</span>
            </Button>
            <Link href={`/items/${item.id}`} onClick={onOpenDetails} className="w-full min-w-0">
              <Button
                type="button"
                variant="outline"
                className="h-9 sm:h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 px-2 min-w-0"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">ดูหน้ารายละเอียดเต็ม</span>
              </Button>
            </Link>
          </div>

          {userCanWrite && (
            <Button
              type="button"
              variant="default"
              onClick={() => onEdit(item)}
              className="h-9 sm:h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 min-w-0"
            >
              <Edit className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">แก้ไขข้อมูล</span>
            </Button>
          )}

          {userCanDelete && (
            <div className="w-full min-w-0">
              <DeleteItemButton id={item.id} />
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (resolvedMode === 'docked') {
    return (
      <aside
        className="w-[340px] xl:w-[380px] 2xl:w-[420px] max-w-[45%] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden transition-all duration-200 z-20"
        aria-label="รายละเอียดรายการ"
        role="region"
        data-testid="inspector-panel"
        data-mode="docked"
      >
        {content}
      </aside>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
        data-testid="inspector-backdrop"
      />

      {/* Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-[460px] flex-col border-l border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250"
        aria-label="รายละเอียดรายการ"
        role="dialog"
        aria-modal="true"
        data-testid="inspector-panel"
        data-mode="drawer"
      >
        {content}
      </aside>
    </>
  )
}

export function InspectorBox({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs min-w-0">
      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      {children}
    </div>
  )
}
