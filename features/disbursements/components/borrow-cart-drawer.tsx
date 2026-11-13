'use client'

import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CentralAvailableItem } from '@/features/disbursements/types'

interface BorrowCartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CentralAvailableItem[]
  selectedIds: Set<string>
  onRemoveItem: (id: string) => void
  onClearAll: () => void
  onProceedToSubmit: () => void
  maxItems?: number
}

export function BorrowCartDrawer({ isOpen, onClose, items, selectedIds, onRemoveItem, onClearAll, onProceedToSubmit, maxItems = 20 }: BorrowCartDrawerProps) {
  const selectedItems = items.filter(item => selectedIds.has(item.id) && !item.unavailable_reason)

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-xl focus:outline-none">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">ตะกร้า</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                {selectedItems.length} รายการ · เลือกได้สูงสุด {maxItems} รายการต่อคำขอ
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="ปิดตะกร้า"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {selectedItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium">ยังไม่มีรายการในตะกร้า</p>
                <p className="mt-2 text-xs text-muted-foreground">กด “ใส่ตะกร้า” ที่รายการที่ต้องการเบิกหรือยืม</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {selectedItems.map(item => (
                  <li key={item.id} className="flex items-start gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{item.item_name}</p>
                      <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{item.asset_no || item.serial_no || 'ไม่มีเลขอ้างอิง'}</p>
                      {item.location_name && <p className="mt-1 text-xs text-muted-foreground">{item.location_name}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)} aria-label={`นำ ${item.item_name} ออกจากตะกร้า`}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="space-y-3 border-t border-border px-5 py-4">
            {selectedItems.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span>{selectedItems.length} รายการ</span>
                <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>ล้างตะกร้า</Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">เลือกเพิ่ม</Button>
              <Button type="button" disabled={!selectedItems.length} onClick={onProceedToSubmit} className="flex-1">ดำเนินการต่อ</Button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
