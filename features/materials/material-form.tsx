'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { saveMaterial, saveMaterialInline, type MaterialActionState } from './actions'
import type { MaterialRecord } from './queries'
import type { ReferenceOption } from '@/features/items/types'
import { MaterialStockPanel } from './material-stock-panel'
import { categoriesForType } from '@/features/items/category-types'

const ledgerFields = [
  ['commodity_code','รหัสวัสดุ','text'],
  ['maximum_quantity','จำนวนอย่างสูง','number'], ['minimum_quantity','จำนวนอย่างต่ำ','number'],
  ['fiscal_year','ปีงบประมาณ พ.ศ.','number'], ['balance_as_of','วันที่ยอดคงเหลือ','date'],
  ['opening_quantity','ยอดยกมา — จำนวน','number'], ['opening_amount','ยอดยกมา — จำนวนเงิน','money'],
  ['received_quantity','รับ — จำนวนตามบัญชีต้นฉบับ','number'], ['received_amount','รับ — จำนวนเงิน','money'],
  ['issued_quantity','จ่าย — จำนวนตามบัญชีต้นฉบับ','number'], ['issued_amount','จ่าย — จำนวนเงิน','money'],
  ['balance_amount','คงเหลือ — จำนวนเงินตามต้นฉบับ','money'],
] as const
const inputClass = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring'
export interface MaterialFormProps {
  material?: Partial<MaterialRecord> & { id: string; item_name: string }
  references: { categories: ReferenceOption[]; units: ReferenceOption[]; locations: ReferenceOption[] }
  inline?: boolean
  formId?: string
  showActions?: boolean
  onSuccess?: (data?: { itemId?: string; intent?: string }) => void
  onPendingChange?: (pending: boolean) => void
}

export function MaterialForm({ material, references, inline = false, formId, showActions = true, onSuccess, onPendingChange }: MaterialFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  type FormState = MaterialActionState & { values?: Record<string, FormDataEntryValue> }
  const [state, action, busy] = useActionState(async (previous: FormState | null, form: FormData): Promise<FormState> => {
    try {
      const result = await (inline ? saveMaterialInline : saveMaterial)(material?.id ?? null, previous, form)
      if (result.success) onSuccess?.({ itemId: result.itemId, intent: String(form.get('intent') ?? 'save_and_close') })
      return result.error ? { ...result, values: Object.fromEntries(form) } : result
    } catch (error) {
      // Full-page saves use Next.js redirects; preserve their control flow.
      if (!inline) throw error
      return { error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง', values: Object.fromEntries(form) }
    }
  }, null)
  useEffect(() => { onPendingChange?.(busy) }, [busy, onPendingChange])
  useEffect(() => {
    // React resets uncontrolled action forms after completion, including validation errors.
    if (!state?.error || !state.values || !formRef.current) return
    for (const control of Array.from(formRef.current.elements)) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue
      if (!control.name) continue
      if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = state.values[control.name] === control.value
      else if (typeof state.values[control.name] === 'string') control.value = String(state.values[control.name])
    }
  }, [state])
  return <div className={inline ? undefined : 'h-full overflow-y-auto'}><form ref={formRef} id={formId} action={action} className={inline ? 'space-y-6' : 'mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6'}>
    {material && <input type="hidden" name="metadata_version" value={String(material.metadata_version ?? '')} />}
    {!inline && <div><Link href="/materials" className="text-sm text-primary hover:underline">กลับทะเบียนวัสดุ</Link><h1 className="mt-2 text-2xl font-bold">{material ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุ'}</h1></div>}
    {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
    <fieldset disabled={busy} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <legend className="px-2 font-semibold">ข้อมูลวัสดุ</legend>
      <label className="text-sm sm:col-span-2">ชื่อหรือชนิดวัสดุ <span className="text-destructive">*</span><input className={inputClass} name="item_name" required maxLength={255} defaultValue={material?.item_name} /></label>
      <label className="text-sm sm:col-span-2" htmlFor="material-specification">ขนาดหรือลักษณะ<textarea id="material-specification" name="specification" className={inputClass} maxLength={2000} rows={3} placeholder="เช่น ขนาด A4 80 แกรม, สีน้ำเงิน, บรรจุ 12 ชิ้น/กล่อง" defaultValue={material?.specification ?? ''} /></label>
      {(['categories','units','locations'] as const).map((group,index) => {const key = ['category_id','unit_id','location_id'][index]; const options = group === 'categories' ? categoriesForType(references.categories, 'material') : references[group]; return <label key={group} className="text-sm">{['ประเภทวัสดุ','หน่วยนับ','สถานที่จัดเก็บ'][index]}<select className={inputClass} name={key} defaultValue={String(material?.[key] ?? '')}><option value="">ไม่ระบุ</option>{options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>})}
      {material ? <div className="text-sm">จำนวนคงเหลือปัจจุบัน<p className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 tabular-nums">{material.quantity ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">เปลี่ยนยอดผ่านเอกสารรับเข้า ปรับยอดตรวจนับ หรือรับคืนเท่านั้น</p></div> : <label className="text-sm">จำนวนคงเหลือปัจจุบัน *<input className={inputClass} name="quantity" type="number" min="0" step="1" required defaultValue={0} /></label>}
      <label className="text-sm">ราคา/หน่วย (บาท)<input className={inputClass} name="unit_price" type="number" min="0" step="0.01" defaultValue={material?.unit_price ?? ''} /></label>
      <label className="text-sm">สถานะ<select name="status" className={inputClass} defaultValue={material?.status ?? 'active'}><option value="active">ใช้งานได้</option><option value="spare">สำรอง</option><option value="damaged">ชำรุด</option><option value="waiting_repair">รอซ่อม</option><option value="inactive">เสื่อมสภาพ</option><option value="disposed">จำหน่าย</option></select></label>
    </fieldset>
    <fieldset disabled={busy} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <legend className="px-2 font-semibold">รายละเอียดตามบัญชีวัสดุ</legend>
      <p className="text-sm text-muted-foreground sm:col-span-2">ยอดยกมา รับ จ่าย และจำนวนเงิน เป็นข้อมูล ณ วันที่ของบัญชีต้นฉบับ ส่วนยอดคงเหลือปัจจุบันใช้สำหรับการเบิกจ่าย เว้นว่างข้อมูลที่ไม่ทราบได้</p>
      {ledgerFields.map(([key,label,type])=><label key={key} className="text-sm">{label}<input className={inputClass} name={key} type={type === 'money' ? 'number' : type} min={type === 'number' || type === 'money' ? '0' : undefined} step={type === 'money' ? '0.01' : type === 'number' ? '1' : undefined} defaultValue={String(material?.[key] ?? '')} /></label>)}
      <label className="text-sm sm:col-span-2">หมายเหตุ<textarea name="note" className={inputClass} maxLength={2000} rows={3} defaultValue="ส่วนกลาง" /></label>
    </fieldset>
    {showActions && <button aria-busy={busy} disabled={busy} className="rounded-lg bg-primary hover:bg-primary/80 px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'บันทึกวัสดุ'}</button>}
  </form>{material && <div className={inline ? 'mt-6' : 'mx-auto w-full max-w-4xl px-4 pb-6 sm:px-6'}><MaterialStockPanel itemId={material.id} /></div>}</div>
}
