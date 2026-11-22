'use client'

import { useEffect, useRef, useCallback, useId, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { ItemForm } from './item-form'
import { createItemInline, updateItem } from '../actions'
import { ItemDetail, ReferenceOption, type ItemType } from '../types'
import { Button } from '@/components/ui/button'
import { MaterialForm } from '@/features/materials/material-form'

const NEW_ITEM_DRAFT_KEY = 'center-asset-material-management-system:new-item-draft'
const NEW_MATERIAL_DRAFT_KEY = 'center-asset-material-management-system:new-material-draft'
const LEGACY_DRAFT_KEYS = ['omni-asset:new-item-draft', 'camms:new-item-draft']

interface NewItemSheetProps {
 open: boolean
 onClose: () => void
 onSuccess: (keepOpen?: boolean) => void
 categories: ReferenceOption[]
 locations: ReferenceOption[]
 units: ReferenceOption[]
 responsibleUsers?: ReferenceOption[]
 item?: ItemDetail | null
 itemType?: ItemType
}

function getDraftControls(root: ParentNode) {
 return Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
 'input[name], select[name], textarea[name]'
 )).filter((control) => {
 if (control instanceof HTMLInputElement) {
 return !['file', 'submit', 'button'].includes(control.type)
 }
 return true
 })
}

function readDraft(key = NEW_ITEM_DRAFT_KEY): Record<string, string> {
 try {
 let raw = window.localStorage.getItem(key)
 if (!raw && key === NEW_ITEM_DRAFT_KEY) {
 for (const legacyKey of LEGACY_DRAFT_KEYS) {
 raw = window.localStorage.getItem(legacyKey)
 if (raw) break
 }
 }
 if (!raw) return {}
 const parsed = JSON.parse(raw)
 return parsed && typeof parsed === 'object' ? parsed : {}
 } catch {
 return {}
 }
}

function restoreDraft(root: ParentNode, key: string) {
 const draft = readDraft(key)
 for (const control of getDraftControls(root)) {
 const value = draft[control.name]
 if (value !== undefined) {
 if (control instanceof HTMLInputElement && control.type === 'checkbox') {
 control.checked = value === 'true'
 } else {
 control.value = value
 }
 }
 }
}

function saveDraft(root: ParentNode, key: string) {
 const draft: Record<string, string> = {}
 for (const control of getDraftControls(root)) {
 if (control instanceof HTMLInputElement && control.type === 'checkbox') {
 draft[control.name] = String(control.checked)
 } else {
 draft[control.name] = control.value
 }
 }
 window.localStorage.setItem(key, JSON.stringify(draft))
}

export function NewItemSheet({
 open,
 onClose,
 onSuccess,
 categories,
 locations,
 units,
 responsibleUsers,
 item = null,
 itemType = 'asset',
}: NewItemSheetProps) {
 const isMaterial = itemType === 'material'
 const draftKey = isMaterial ? NEW_MATERIAL_DRAFT_KEY : NEW_ITEM_DRAFT_KEY
 const dialogRef = useRef<HTMLDialogElement>(null)
 const [formVersion, setFormVersion] = useState(0)
 const [pending, setPending] = useState(false)
 const formId = useId()

 useEffect(() => {
 const dialog = dialogRef.current
 if (!dialog) return

 if (open) {
 if (dialog.open) return
 dialog.showModal()
 setFormVersion((version) => version + 1)
 } else if (dialog.open) {
 dialog.close()
 }
 }, [open])

 useEffect(() => {
 const dialog = dialogRef.current
 if (!open || !dialog) return
 if (!item) {
 restoreDraft(dialog, draftKey)
 }
 }, [open, formVersion, item, draftKey])

 useEffect(() => {
 const dialog = dialogRef.current
 if (!open || !dialog || item) return

 const handleDraftChange = () => saveDraft(dialog, draftKey)
 dialog.addEventListener('input', handleDraftChange)
 dialog.addEventListener('change', handleDraftChange)

 return () => {
 dialog.removeEventListener('input', handleDraftChange)
 dialog.removeEventListener('change', handleDraftChange)
 }
 }, [open, formVersion, item, draftKey])

 const handleSuccess = useCallback((data?: { itemId?: string; intent?: string }) => {
 const isSaveAndAnother = data?.intent === 'save_and_another'
 if (isSaveAndAnother) {
 const draft = readDraft(draftKey)
 delete draft.item_name
 delete draft.asset_no
 delete draft.serial_no
 delete draft.unit_price
 delete draft.image_file
 delete draft.note
 delete draft.gfmis_number
 if (isMaterial) {
 for (const key of ['quantity', 'specification', 'commodity_code', 'minimum_quantity', 'maximum_quantity',
 'opening_quantity', 'opening_amount', 'received_quantity', 'received_amount', 'issued_quantity', 'issued_amount', 'balance_amount']) delete draft[key]
 }
 window.localStorage.setItem(draftKey, JSON.stringify(draft))
 setFormVersion((v) => v + 1)
 onSuccess(true)
 } else {
 window.localStorage.removeItem(draftKey)
 for (const legacyKey of isMaterial ? [] : LEGACY_DRAFT_KEYS) {
 window.localStorage.removeItem(legacyKey)
 }
 setFormVersion((version) => version + 1)
 onSuccess(false)
 }
 }, [onSuccess, draftKey, isMaterial])

 const handleCloseAttempt = useCallback(() => {
 if (pending) return
 onClose()
 }, [onClose, pending])

 // Close on backdrop click (outside the panel).
 // Native <dialog>: backdrop clicks have event.target === dialog element itself.
 const handleDialogClick = useCallback(
 (e: React.MouseEvent<HTMLDialogElement>) => {
 if (e.target === dialogRef.current) handleCloseAttempt()
 },
 [handleCloseAttempt]
 )

 // Close on Escape key
 const handleCancel = useCallback(
 (e: Event) => {
 e.preventDefault()
 handleCloseAttempt()
 },
 [handleCloseAttempt]
 )

 useEffect(() => {
 const dialog = dialogRef.current
 if (!dialog) return
 dialog.addEventListener('cancel', handleCancel)
 return () => dialog.removeEventListener('cancel', handleCancel)
 }, [handleCancel])

 return (
 <>
 <dialog
 ref={dialogRef}
 aria-labelledby={`${formId}-title`}
 onClick={handleDialogClick}
 className="new-item-sheet-dialog"
 >
 {/* Centered panel with independently scrolling content */}
 <div
 className="new-item-sheet-panel bg-card text-card-foreground border-border"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="new-item-sheet-header bg-card text-card-foreground border-border">
 <div className="flex items-center gap-3">
 <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
 <Plus className="h-5 w-5" />
 </div>
 <div>
 <h2 id={`${formId}-title`} className="text-lg font-bold tracking-tight text-slate-900 ">
 {isMaterial ? item ? 'แก้ไขรายการวัสดุ' : 'ขึ้นทะเบียนวัสดุใหม่' : item ? 'แก้ไขรายการครุภัณฑ์' : 'ขึ้นทะเบียนครุภัณฑ์ใหม่'}
 </h2>
 </div>
 </div>
 <button
 type="button"
 onClick={handleCloseAttempt}
 className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
 aria-label="ปิด"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* Scrollable form body */}
 <div className="new-item-sheet-body bg-background text-foreground">
 {isMaterial ? <MaterialForm
 key={formVersion}
 material={item ? { ...item.material, id: item.id, item_name: item.item_name, quantity: item.quantity,
 metadata_version: item.metadata_version, stock_version: item.stock_version,
 unit_price: item.unit_price, category_id: item.category?.id ?? null, unit_id: item.unit?.id ?? null,
 location_id: item.location?.id ?? null, status: item.status, is_central: item.is_central,
 note: item.note } : undefined}
 references={{ categories, locations, units }}
 inline
 onSuccess={handleSuccess}
 onPendingChange={setPending}
 formId={formId}
 showActions={false}
 /> : <ItemForm
 key={formVersion}
 action={item ? updateItem.bind(null, item.id) : createItemInline}
 categories={categories}
 locations={locations}
 units={units}
 responsibleUsers={responsibleUsers}
 item={item ?? undefined}
 inline
 onCancel={handleCloseAttempt}
 onSuccess={handleSuccess}
 onPendingChange={setPending}
 formId={formId}
 showActions={false}
 />}
 </div>

 <div className="new-item-sheet-footer bg-card text-card-foreground border-border">
 <span className="mr-auto hidden text-xs text-muted-foreground sm:block">ตรวจสอบข้อมูลก่อนบันทึก</span>
 <Button type="button" variant="outline" disabled={pending} onClick={handleCloseAttempt} className="cursor-pointer">ยกเลิก</Button>
 {!item && (
 <Button aria-busy={pending}
 type="submit"
 name="intent"
 value="save_and_another"
 form={formId}
 disabled={pending}
 className="gap-2 cursor-pointer"
 >
 <span>บันทึกและเพิ่มรายการถัดไป</span>
 </Button>
 )}
 <Button aria-busy={pending} type="submit" name="intent" value="save_and_close" form={formId} disabled={pending} className="gap-2 cursor-pointer">
 {pending ? 'กำลังบันทึก...' : item ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
 </Button>
 </div>
 </div>

 <style>{`
 .new-item-sheet-dialog {
 position: fixed;
 inset: 0;
 width: 100%;
 height: 100%;
 max-width: 100%;
 max-height: 100%;
 margin: 0;
 padding: 16px;
 border: none;
 outline: none;
 background: transparent;
 overflow: hidden;
 align-items: center;
 justify-content: center;
 }

 .new-item-sheet-dialog[open] {
 display: flex;
 }

 .new-item-sheet-dialog::backdrop {
 background: rgba(15, 23, 42, 0.45);
 backdrop-filter: blur(2px);
 }

 .new-item-sheet-panel {
 width: 100%;
 max-width: 800px;
 max-height: min(92vh, 860px);
 background: var(--card);
 color: var(--card-foreground);
 display: flex;
 flex-direction: column;
 box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
 border: 1px solid var(--border);
 border-radius: 20px;
 overflow: hidden;
 }

 .new-item-sheet-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 12px;
 padding: 18px 20px 14px;
 border-bottom: 1px solid var(--border);
 background: var(--card);
 color: var(--card-foreground);
 flex-shrink: 0;
 z-index: 1;
 }

 .new-item-sheet-body {
 flex: 1;
 overflow-y: auto;
 padding: 20px;
 background: var(--background);
 color: var(--foreground);
 min-height: 0;
 overscroll-behavior: contain;
 }

 .new-item-sheet-footer {
 display: flex;
 align-items: center;
 justify-content: flex-end;
 gap: 8px;
 flex-shrink: 0;
 padding: 14px 20px;
 border-top: 1px solid var(--border);
 background: var(--card);
 color: var(--card-foreground);
 }

 /* Override ItemForm card styling inside sheet — remove double border */
 .new-item-sheet-body form {
 border: none !important;
 box-shadow: none !important;
 padding: 0 !important;
 background: transparent !important;
 border-radius: 0 !important;
 }

 @media (max-width: 640px) {
 .new-item-sheet-dialog {
 padding: 8px;
 }

 .new-item-sheet-panel {
 width: min(100%, 760px);
 max-height: calc(100dvh - 16px);
 }

 .new-item-sheet-header,
 .new-item-sheet-body,
 .new-item-sheet-footer {
 padding-left: 16px;
 padding-right: 16px;
 }
 }
 `}</style>
 </dialog>
 </>
 )
}
