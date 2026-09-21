'use client'

import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { ITEM_STATUS_LABELS, type ReferenceOption } from '../types'
import { bulkUpdatesSchema, type BulkItemUpdates } from '../bulk-edit'
import type { ActionResponse } from '@/lib/actions-helper'

const fields = [
  ['location_id', 'สถานที่จัดเก็บ'], ['category_id', 'หมวดหมู่'],
  ['unit_id', 'หน่วยนับ'], ['responsible_person', 'ผู้รับผิดชอบ'], ['status', 'สถานะ'],
] as const
type Field = typeof fields[number][0]

export function BulkEditDialog({ count, locations, categories, units, onClose, onSave, onSaved }: {
  count: number; locations: ReferenceOption[]; categories: ReferenceOption[]; units: ReferenceOption[]
  onClose: () => void; onSave: (updates: BulkItemUpdates) => Promise<ActionResponse>; onSaved: (message: string) => void
}) {
  const [enabled, setEnabled] = useState<Partial<Record<Field, boolean>>>({})
  const [values, setValues] = useState<Partial<Record<Field, string>>>({})
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const options: Partial<Record<Field, ReferenceOption[]>> = {
    location_id: locations, category_id: categories, unit_id: units,
    status: Object.entries(ITEM_STATUS_LABELS).map(([id, name]) => ({ id, name })),
  }
  const patch = Object.fromEntries(fields.filter(([key]) => enabled[key]).map(([key]) => [key, values[key] ?? '']))
  const selected = fields.filter(([key]) => enabled[key])
  async function submit() {
    const parsed = bulkUpdatesSchema.safeParse(patch)
    if (!parsed.success) { setError('เลือกช่องที่ต้องการแก้ไขและกรอกค่าให้ครบ'); return }
    setSaving(true); setError('')
    try {
      const result = await onSave(parsed.data)
      if (result.success) onSaved(result.message || 'บันทึกเรียบร้อย')
      else setError(result.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSaving(false) }
  }
  return <Dialog.Root open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('bulk-edit-trigger')?.focus() }} onEscapeKeyDown={event => { if (saving) event.preventDefault() }} onPointerDownOutside={event => event.preventDefault()}
        className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
        <Dialog.Title className="text-lg font-semibold">{review ? 'ยืนยันการแก้ไข' : 'แก้ไขหลายรายการ'} ({count} รายการ)</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm text-muted-foreground">ช่องที่ไม่ได้เลือกจะคงค่าเดิมของแต่ละรายการ</Dialog.Description>
        <form onSubmit={event => { event.preventDefault(); if (review) void submit(); else { if (bulkUpdatesSchema.safeParse(patch).success) { setReview(true); setError('') } else setError('เลือกช่องที่ต้องการแก้ไขและกรอกค่าให้ครบ') } }}>
          {review ? <ul className="my-5 space-y-3 text-sm">{selected.map(([key, label]) => <li key={key}><span className="font-medium">{label}:</span> {options[key]?.find(option => option.id === values[key])?.name ?? (values[key] || 'ล้างข้อมูลผู้รับผิดชอบ')}</li>)}</ul>
            : <div className="my-5 space-y-4">{fields.map(([key, label]) => <div key={key}>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!enabled[key]} onChange={event => setEnabled({ ...enabled, [key]: event.target.checked })} />แก้ไข{label}</label>
              {enabled[key] && (key === 'responsible_person'
                ? <input aria-label={label} maxLength={200} value={values[key] ?? ''} placeholder="เว้นว่างเพื่อล้างผู้รับผิดชอบ" onChange={event => setValues({ ...values, [key]: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                : <select aria-label={label} required value={values[key] ?? ''} onChange={event => setValues({ ...values, [key]: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">เลือก{label}</option>{options[key]?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>)}
            </div>)}</div>}
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>ยกเลิก</Button>
            {review && <Button type="button" variant="outline" disabled={saving} onClick={() => setReview(false)}>กลับไปแก้ไข</Button>}
            <Button type="submit" disabled={saving || selected.length === 0}>{saving ? 'กำลังบันทึก...' : review ? `ยืนยันแก้ไข ${count} รายการ` : 'ตรวจสอบก่อนบันทึก'}</Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
