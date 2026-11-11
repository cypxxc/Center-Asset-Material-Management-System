'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Banknote,
  Boxes,
  Building2,
  Calendar,
  Copy,
  Edit,
  ExternalLink,
  FileText,
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
import { ITEM_QUALIFICATION_LABELS, ITEM_TYPE_LABELS, type ItemListRow } from '@/features/items/types'
import { CategoryBadge } from '@/features/items/components/category-badge'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatDateThaiBE } from '@/lib/date'

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
              <CategoryBadge
                name={item.category?.name || 'หมวดหมู่ทั่วไป'}
                color={item.category?.color}
                icon={item.category?.icon}
                className="max-w-[200px]"
              />
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary shrink-0">
                {ITEM_TYPE_LABELS[item.item_type]}
              </span>
              {item.qualification_status && <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0">{ITEM_QUALIFICATION_LABELS[item.qualification_status]}</span>}
            </div>
          </div>

          {/* SECTION 1: ข้อมูลระบุตัวตน (Tone Blue) */}
          <DrawerSectionHeading tone="blue" icon={<Tag className="h-3 w-3" />} label="ข้อมูลระบุตัวตน" />
          {item.asset_no && (
            <InspectorBox tone="blue" icon={<Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />} label={item.item_type === 'material' ? 'เลขทะเบียนพัสดุ' : 'เลขครุภัณฑ์'}>
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
            <InspectorBox tone="blue" icon={<Tag className="h-3.5 w-3.5 text-blue-500 shrink-0" />} label="Serial Number">
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
            <InspectorBox tone="blue" icon={<Tag className="h-3.5 w-3.5 text-blue-500 shrink-0" />} label="เลขอ้างอิง">
              <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground min-w-0">
                - ไม่มีเลขอ้างอิง -
              </p>
            </InspectorBox>
          )}

          {/* SECTION 2: คุณลักษณะและยี่ห้อ (Tone Violet) */}
          <DrawerSectionHeading tone="violet" icon={<Boxes className="h-3 w-3" />} label="คุณลักษณะ & ยี่ห้อ" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
            {(item.brand || item.model) ? (
              <InspectorBox tone="violet" icon={<Boxes className="h-3.5 w-3.5 text-violet-500 shrink-0" />} label="ยี่ห้อ / รุ่น">
                <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={[item.brand, item.model].filter(Boolean).join(' - ')}>
                  {[item.brand, item.model].filter(Boolean).join(' - ') || '-'}
                </div>
              </InspectorBox>
            ) : null}

            <InspectorBox tone="violet" icon={<Package className="h-3.5 w-3.5 text-violet-500 shrink-0" />} label="จำนวนคงเหลือ">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
                {item.quantity} {item.unit?.name ?? ''}
              </div>
            </InspectorBox>
          </div>

          {/* SECTION 3: มูลค่าและงบประมาณ (Tone Teal) */}
          <DrawerSectionHeading tone="teal" icon={<Banknote className="h-3 w-3" />} label="มูลค่า & งบประมาณ" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
            <InspectorBox tone="teal" icon={<Banknote className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />} label="ราคาต่อหน่วย">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
                {item.unit_price !== null && item.unit_price !== undefined ? `฿${item.unit_price.toLocaleString()}` : '-'}
              </div>
            </InspectorBox>

            {item.gfmis_number ? (
              <InspectorBox tone="teal" icon={<Tag className="h-3.5 w-3.5 text-teal-500 shrink-0" />} label="เลขสินทรัพย์ (GFMIS)">
                <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 font-mono text-xs font-semibold text-card-foreground truncate" title={item.gfmis_number}>
                  {item.gfmis_number}
                </div>
              </InspectorBox>
            ) : null}

            {item.budget_source ? (
              <InspectorBox tone="teal" icon={<Building2 className="h-3.5 w-3.5 text-teal-500 shrink-0" />} label="รับจาก (งปม.)">
                <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={item.budget_source}>
                  {item.budget_source}
                </div>
              </InspectorBox>
            ) : null}

            {item.acquired_date ? (
              <InspectorBox tone="teal" icon={<Calendar className="h-3.5 w-3.5 text-teal-500 shrink-0" />} label="วันที่รับเข้า">
                <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate">
                  {formatDateThaiBE(item.acquired_date)}
                </div>
              </InspectorBox>
            ) : null}
          </div>

          {/* SECTION 4: สถานที่และการครอบครอง (Tone Indigo) */}
          <DrawerSectionHeading tone="indigo" icon={<MapPin className="h-3 w-3" />} label="สถานที่ & ผู้ครอบครอง" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
            <InspectorBox tone="indigo" icon={<MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />} label="สถานที่จัดเก็บ">
              <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={item.location?.name}>
                {item.location?.name || 'ไม่ได้ระบุ'}
              </div>
            </InspectorBox>

            <InspectorBox tone="indigo" icon={<User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />} label="ผู้รับผิดชอบ">
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground min-w-0">
                <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {(item.responsible_person || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-card-foreground truncate flex-1 min-w-0" title={item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}>
                  {item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}
                </span>
              </div>
            </InspectorBox>
          </div>

          {/* SECTION 5: หมายเหตุ (Tone Slate) */}
          <DrawerSectionHeading tone="slate" icon={<StickyNote className="h-3 w-3" />} label="หมายเหตุ" />
          <InspectorBox tone="slate" icon={<StickyNote className="h-3.5 w-3.5 text-slate-500 shrink-0" />} label="รายละเอียดเพิ่มเติม">
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
            {userCanWrite && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrint(stickerData)}
              className="h-9 sm:h-10 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 px-2 min-w-0"
            >
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">พิมพ์ป้ายบาร์โค้ด</span>
            </Button>
            )}
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
            <Link
              href={`/disbursements/new?items=${item.id}&type=${item.item_type === 'material' ? 'material_issue' : 'asset_borrow'}`}
              className="w-full min-w-0"
            >
              <Button
                type="button"
                variant="outline"
                className="h-9 sm:h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 min-w-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {item.item_type === 'asset' ? 'ทำรายการขอเบิก/ยืมครุภัณฑ์นี้' : 'ทำรายการขอเบิกพัสดุนี้'}
                </span>
              </Button>
            </Link>
          )}

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

function DrawerSectionHeading({
  tone,
  icon,
  label,
}: {
  tone: 'blue' | 'violet' | 'teal' | 'indigo' | 'slate'
  icon: ReactNode
  label: string
}) {
  const tonePills = {
    blue: 'border-blue-200/80 bg-blue-50/80 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300',
    violet: 'border-violet-200/80 bg-violet-50/80 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-300',
    teal: 'border-teal-200/80 bg-teal-50/80 text-teal-700 dark:border-teal-800/70 dark:bg-teal-950/40 dark:text-teal-300',
    indigo: 'border-indigo-200/80 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/40 dark:text-indigo-300',
    slate: 'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-300',
  }

  return (
    <div className="flex items-center gap-2 pt-2 pb-0.5">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-2xs ${tonePills[tone]}`}>
        {icon}
        <span>{label}</span>
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}

function InspectorBox({
  icon,
  label,
  children,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  children: ReactNode
  tone?: 'blue' | 'violet' | 'teal' | 'indigo' | 'slate' | 'default'
}) {
  const toneLabelClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    violet: 'text-violet-600 dark:text-violet-400',
    teal: 'text-teal-600 dark:text-teal-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    slate: 'text-slate-600 dark:text-slate-400',
    default: 'text-primary',
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs min-w-0">
      <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${toneLabelClasses[tone]} min-w-0`}>
        {icon}
        <span className="truncate">{label}</span>
      </p>
      {children}
    </div>
  )
}
