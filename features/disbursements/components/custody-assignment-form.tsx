'use client'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Check, Layers, MapPin, Plus, X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormLabel } from '@/components/ui/form'
import { SearchInput } from '@/components/ui/search-input'
import { CustodyRecipientCombobox } from './custody-recipient-combobox'
import { assignCustody } from '../actions'
import type { DisbursementSelectableItem } from '../types'

interface Props {
  items: DisbursementSelectableItem[]
  users: { id: string; full_name: string }[]
  onCancel: () => void
  onSuccess: () => void
  onPendingChange: (pending: boolean) => void
  onPickerOpenChange?: (open: boolean) => void
}

export function CustodyAssignmentForm({ items, users, onCancel, onSuccess, onPendingChange, onPickerOpenChange }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [recipient, setRecipient] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draftSelected, setDraftSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const selectedItems = items.filter((item) => selected.includes(item.id))
  const selectableItems = items.filter((item) => !query.trim() || [item.item_name, item.asset_no, item.responsible_person].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())))

  function changePickerOpen(open: boolean) {
    if (open) { setDraftSelected(selected); setQuery('') }
    setPickerOpen(open)
    onPickerOpenChange?.(open)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected.length) { setError('กรุณาเลือกสิ่งของ'); return }
    if (!recipient) { setError('กรุณาเลือกผู้ถือครอง'); return }
    setError(''); setPending(true); onPendingChange(true)
    try {
      const result = await assignCustody({ item_ids: selected, recipient_id: recipient })
      if (!result.ok) { setError(result.error || 'บันทึกไม่สำเร็จ'); return }
      onSuccess()
    } catch { setError('บันทึกไม่สำเร็จ กรุณาลองใหม่') }
    finally { setPending(false); onPendingChange(false) }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-5">
        {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>}
        <section className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-semibold">รายการ <span className="ml-1 text-xs font-normal text-muted-foreground">{selected.length} รายการ</span></h3>
            <Button type="button" variant="outline" size="sm" disabled={pending} aria-expanded={pickerOpen} onClick={() => changePickerOpen(true)} className="gap-1.5 text-xs font-normal"><Plus className="size-3.5" />เลือกสิ่งของ</Button>
          </div>
          {selectedItems.length ? (
            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-xs font-medium">{item.item_name}</p>
                    <p className="break-words text-[11px] text-muted-foreground">{item.asset_no || 'ไม่ระบุเลขครุภัณฑ์'} · ผู้ถือครองเดิม: {item.responsible_person || 'ยังไม่กำหนด'}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={pending} aria-label={`นำ ${item.item_name} ออก`} onClick={() => setSelected((ids) => ids.filter((id) => id !== item.id))}><X className="size-3.5" /></Button>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-9 text-center text-xs text-muted-foreground">เลือกครุภัณฑ์ส่วนกลางที่ต้องการมอบหมาย</p>}
        </section>
        <div className="space-y-1.5">
          <FormLabel htmlFor="custody-recipient" required>ผู้ถือครอง</FormLabel>
          <CustodyRecipientCombobox users={users} value={recipient} onChange={setRecipient} disabled={pending} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="font-normal">ยกเลิก</Button>
          <Button type="submit" disabled={pending || !users.length} className="border border-primary/30 bg-primary/10 text-primary font-normal hover:bg-primary/15">{pending ? 'กำลังบันทึก...' : 'ยืนยันผู้ถือครอง'}</Button>
        </div>
      </form>
      <Dialog.Root open={pickerOpen} onOpenChange={changePickerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/25" />
          <Dialog.Content aria-describedby={undefined} onInteractOutside={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-[60] flex h-[min(46rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl lg:left-auto lg:right-[calc(50%+0.5rem)] lg:w-[calc(50vw-2rem)] lg:max-w-2xl lg:translate-x-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold">เลือกสิ่งของส่วนกลาง</Dialog.Title>
              <Dialog.Close asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="ปิดหน้าต่างเลือกสิ่งของ"><X className="size-4" /></Button></Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 bg-muted/10 p-4">
              <div className="h-8 shrink-0">
                <SearchInput value={query} onChange={setQuery} aria-label="ค้นหาสิ่งของส่วนกลาง" placeholder="ค้นหาชื่อ, เลขครุภัณฑ์, ผู้ถือครองเดิม..." className="h-8 text-xs" />
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2.5 overflow-y-auto p-0.5 sm:grid-cols-3">
                {selectableItems.length ? selectableItems.map((item) => (
                  <label key={item.id} className={cn('group relative flex min-w-0 cursor-pointer flex-col rounded-xl border bg-card p-2.5 text-card-foreground transition-colors focus-within:ring-2 focus-within:ring-ring', draftSelected.includes(item.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/40', (pending || (!draftSelected.includes(item.id) && draftSelected.length >= 20)) && 'cursor-not-allowed opacity-50')}>
                    <input type="checkbox" className="peer sr-only" aria-label={`เลือก ${item.item_name}`} checked={draftSelected.includes(item.id)} disabled={pending || (!draftSelected.includes(item.id) && draftSelected.length >= 20)} onChange={(event) => setDraftSelected((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />
                    <span className="mb-2 flex items-center justify-between gap-1 text-[10px]"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">ส่วนกลาง</span><span className={cn('flex size-4 items-center justify-center rounded border', draftSelected.includes(item.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{draftSelected.includes(item.id) && <Check className="size-3" />}</span></span>
                    <span className="relative mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-24">
                      {item.image_url ? <Image src={item.image_url} alt="" fill sizes="(max-width: 640px) 40vw, 200px" className="object-cover" unoptimized /> : <Layers className="size-7 text-muted-foreground/50" />}
                    </span>
                    <span className="block break-words text-xs font-medium leading-relaxed">{item.item_name}</span>
                    <span className="mt-1 block break-words font-mono text-[10px] text-muted-foreground">{item.asset_no || 'ไม่ระบุเลขครุภัณฑ์'}</span>
                    {item.location_name && <span className="mt-1.5 flex items-start gap-1 text-[10px] text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" /><span className="break-words">{item.location_name}</span></span>}
                    <span className="mt-1 block break-words text-[10px] text-muted-foreground">ผู้ถือครอง: {item.responsible_person || 'ยังไม่กำหนด'}</span>
                    <span className={cn('mt-auto pt-2 text-center text-[11px]', draftSelected.includes(item.id) ? 'text-primary' : 'text-muted-foreground')}>{draftSelected.includes(item.id) ? 'เลือกแล้ว' : 'เลือกรายการนี้'}</span>
                  </label>
                )) : <p className="p-5 text-center text-xs text-muted-foreground">ไม่พบสิ่งของส่วนกลาง</p>}
              </div>
              <p className="text-[11px] text-muted-foreground">เลือกได้ครั้งละไม่เกิน 20 รายการ</p>
              <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => { setSelected(draftSelected); changePickerOpen(false) }} className="h-8 border-primary/30 bg-primary/10 text-primary text-xs font-normal hover:bg-primary/15">ยืนยันรายการ ({draftSelected.length})</Button></div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
