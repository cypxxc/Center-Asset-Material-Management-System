'use client'

import Link from 'next/link'
import { Edit, ExternalLink, Package, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemDetailSections } from '@/features/items/components/item-detail-sections'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import type { ItemListRow } from '@/features/items/types'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'

export function Inspector({
  isOpen,
  onClose,
  item,
  userCanWrite,
  userCanDelete,
  onCopy,
  onPrint,
  onEdit,
}: {
  isOpen: boolean
  onClose: () => void
  item: ItemListRow | null
  userCanWrite: boolean
  userCanDelete: boolean
  onCopy: (value: string | null | undefined) => void
  onPrint: (item: ItemStickerData) => void
  onEdit: (item: ItemListRow) => void
}) {
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250"
        aria-label="รายละเอียดรายการ"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">รายละเอียดสิ่งของ</span>
            <h3 className="break-words text-base font-extrabold text-card-foreground">{item.item_name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="ปิดแถบรายละเอียด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {/* Image preview */}
          <div className="relative h-52 shrink-0 overflow-hidden border-b border-border bg-muted">
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
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ยังไม่มีรูปภาพ</span>
              </div>
            )}

            <Link
              href={`/items/${item.id}`}
              className="absolute right-3 top-3 rounded-full bg-card/95 p-2 text-primary shadow-md transition-transform hover:scale-105 hover:bg-card"
              title="เปิดหน้ารายละเอียดเต็ม"
              aria-label="เปิดหน้ารายละเอียดเต็ม"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-4 sm:p-5">
            <ItemDetailSections item={item} onCopy={onCopy} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-border bg-card p-4">
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onPrint(stickerData)}
                className="h-10 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Tag className="h-4 w-4" />
                <span>พิมพ์สติกเกอร์</span>
              </Button>
              <Link href={`/items/${item.id}`} className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>ดูหน้ารายละเอียดเต็ม</span>
                </Button>
              </Link>
            </div>

            {userCanWrite && (
              <Button
                type="button"
                variant="default"
                onClick={() => onEdit(item)}
                className="h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                  <Edit className="h-4 w-4" />
                  <span>แก้ไขข้อมูล</span>
              </Button>
            )}

            {userCanDelete && (
              <div className="w-full">
                <DeleteItemButton id={item.id} />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
