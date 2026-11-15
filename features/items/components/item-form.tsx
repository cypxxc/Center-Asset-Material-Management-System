'use client'

import { FormCombobox } from '@/components/ui/form-combobox'

import { normalizeItemStatus } from '../status'

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Save, Image as ImageIcon, Trash2, Upload, Package, ClipboardList, MapPin, Tag, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ItemActionState } from '../actions'
import {
 FormField,
 FormLabel,
 FormError,
 FormGrid,
 FormActions,
 FormInput,
 FormTextarea
} from '@/components/ui/form'
import { FormattedNumberInput } from '@/components/ui/formatted-number-input'
import { ItemDetail, ReferenceOption } from '../types'
import { ImageCropDialog } from '@/components/ui/image-crop-dialog'
import { DepreciationFields } from '@/features/depreciation/components/depreciation-fields'
import { syncCentralNote } from '../central-note'

interface ItemFormProps {
 action: (state: ItemActionState | null, formData: FormData) => Promise<ItemActionState>
 categories: ReferenceOption[]
 locations: ReferenceOption[]
 units: ReferenceOption[]
 responsibleUsers?: ReferenceOption[]
 item?: ItemDetail
 inline?: boolean
 onCancel?: () => void
 /** Called after a successful inline create (modal mode). Not called when redirect happens. */
 onSuccess?: (result?: { itemId?: string; intent?: string }) => void
 /** Shares action status with the modal footer. */
 onPendingChange?: (pending: boolean) => void
 /** Lets a submit button outside the form reference this form. */
 formId?: string
 /** Hides the standalone form actions when a parent owns the fixed footer. */
 showActions?: boolean
}

function FieldError({ errors }: { errors?: string[] }) {
 if (!errors?.length) return null
 return <FormError>{errors[0]}</FormError>
}


export function ItemForm(props: ItemFormProps) {
 const [version, setVersion] = useState(0)
 return <ItemFormFields key={version} {...props} onSuccess={props.onSuccess ?? (result => {
 if (!props.item && result?.intent === 'save_and_another') setVersion(previous => previous + 1)
 })} />
}

function ItemFormFields({
 action,
 categories,
 locations,
 units,
 responsibleUsers = [],
 item,
 inline = false,
 onCancel,
 onSuccess,
 onPendingChange,
 formId,
 showActions = true,
}: ItemFormProps) {
 const [state, formAction, pending] = useActionState(action, null)
 const [isCentral, setIsCentral] = useState(Boolean(item?.is_central || item?.note?.includes('ส่วนกลาง')))
 const [note, setNote] = useState(item?.note ?? '')
 useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
 // Dismiss only the current response; subsequent saves show fresh feedback.
 const [dismissed, setDismissed] = useState<typeof state>(null)
 const showMessage = !!state?.message && dismissed !== state

 // Use a ref for onSuccess callback to avoid infinite loop when parent re-renders
 const onSuccessRef = useRef(onSuccess)
 useEffect(() => {
 onSuccessRef.current = onSuccess
 }, [onSuccess])

 useEffect(() => {
 if (state?.success) {
 onSuccessRef.current?.(state.data as { itemId?: string; intent?: string } | undefined)
 }
 }, [state])

 const [activeTab, setActiveTab] = useState<'asset' | 'material'>(
 item?.item_type === 'asset' || !item?.item_type ? 'asset' : 'material'
 )

 const [currentQty, setCurrentQty] = useState<number>(Number(item?.quantity) || 1)
 const [currentUnitPrice, setCurrentUnitPrice] = useState<number | null>(
 item?.unit_price !== null && item?.unit_price !== undefined ? Number(item.unit_price) : null
 )

 const liveTotal = useMemo(() => {
 if (currentQty > 0 && currentUnitPrice !== null && currentUnitPrice >= 0) {
 return currentQty * currentUnitPrice
 }
 return null
 }, [currentQty, currentUnitPrice])

 const itemType = item?.item_type ?? activeTab

 return (
 <form
 id={formId}
 action={formAction}
 onSubmit={event => {
 // Dispatch explicitly so React does not reset editable fields and confirmed
 // files when a Server Action returns a validation error.
 event.preventDefault()
 const submitter = (event.nativeEvent as SubmitEvent).submitter
 const data = new FormData(event.currentTarget, submitter)
 startTransition(() => formAction(data))
 }}
 className="flex flex-col gap-8 rounded-xl border border-border bg-card px-4 py-5 text-foreground sm:p-8 [&_label]:text-sm [&_label]:font-medium [&_input:not([type=checkbox])]:h-11 [&_input:not([type=checkbox])]:border-input [&_input:not([type=checkbox])]:bg-card [&_input:not([type=checkbox])]:text-sm [&_input:not([type=checkbox])]:text-foreground [&_input::placeholder]:text-muted-foreground [&_textarea]:border-input [&_textarea]:bg-card [&_textarea]:text-sm [&_textarea]:text-foreground [&_textarea::placeholder]:text-muted-foreground"
 >
 {inline && <input type="hidden" name="inline" value="true" />}
 {showMessage && (
 <div role={state.success ? 'status' : 'alert'} className={cn('rounded-lg border p-4 text-sm', state.success ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
 <div className="flex items-center justify-between gap-3">
 <p>{state.message}</p>
 <button
 type="button"
 onClick={() => setDismissed(state)}
 className="shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
 >
 ปิด
 </button>
 </div>
 </div>
 )}

 {/* Type selector */}
 {!item && (
 <div role="tablist" aria-label="ประเภทสิ่งของ" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
 <button
 type="button"
 role="tab"
 aria-label="ครุภัณฑ์"
 aria-selected={activeTab === 'asset'}
 aria-controls="asset-details"
 onClick={() => setActiveTab('asset')}
 className={cn(
 'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer relative select-none',
 activeTab === 'asset'
 ? 'border-blue-600/60 bg-blue-500/10 shadow-xs ring-1 ring-blue-500/30'
 : 'border-border bg-card/60 hover:bg-muted/50 hover:border-border/80'
 )}
 >
 <div className={cn(
 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-xs transition-colors',
 activeTab === 'asset' ? 'bg-blue-600 text-white shadow-xs' : 'bg-muted text-muted-foreground'
 )}>
 <Package className="h-4 w-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-bold text-xs text-foreground">ครุภัณฑ์ (Asset)</span>
 </div>
 <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
 มีเลขครุภัณฑ์หลัก ทะเบียนสินทรัพย์ GFMIS และคำนวณค่าเสื่อมราคา
 </p>
 </div>
 </button>

 <button
 type="button"
 role="tab"
 aria-label="พัสดุ"
 aria-selected={activeTab === 'material'}
 aria-controls="material-details"
 onClick={() => setActiveTab('material')}
 className={cn(
 'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer relative select-none',
 activeTab === 'material'
 ? 'border-amber-500/60 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
 : 'border-border bg-card/60 hover:bg-muted/50 hover:border-border/80'
 )}
 >
 <div className={cn(
 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-xs transition-colors',
 activeTab === 'material' ? 'bg-amber-600 text-white shadow-xs' : 'bg-muted text-muted-foreground'
 )}>
 <ClipboardList className="h-4 w-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-bold text-xs text-foreground">พัสดุ (Material)</span>
 <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9.5px] font-semibold bg-amber-500/15 text-amber-700 border border-amber-500/25">
 พัสดุคงทน
 </span>
 </div>
 <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
 ใช้ลงทะเบียนพัสดุและติดตามประวัติ/สถานที่ โดยไม่คิดค่าเสื่อมราคา
 </p>
 </div>
 </button>
 </div>
 )}

 <input type="hidden" name="item_type" value={itemType} />

 {/* SECTION 1: ข้อมูลหลัก */}
 <FormSection title="ข้อมูลหลัก" tone="blue" icon={<Package className="h-4 w-4" />}>
 <FormGrid className="sm:grid-cols-2">
 <FormField className="sm:col-span-2">
 <FormLabel htmlFor="qualification_status">สถานะตามเกณฑ์ครุภัณฑ์</FormLabel>
 <FormCombobox id="qualification_status" name="qualification_status" defaultValue={item?.qualification_status ?? ''} aria-invalid={!!state?.fieldErrors?.qualification_status}>
 <option value="">ยังไม่ระบุ</option>
 <option value="qualified">ครุภัณฑ์ตามเกณฑ์</option>
 <option value="below_threshold">ครุภัณฑ์ต่ำกว่าเกณฑ์ (ต.)</option>
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.qualification_status} />
 </FormField>
 <FormField className="sm:col-span-2">
 <FormLabel htmlFor="item_name" required>ชื่อสิ่งของ</FormLabel>
 <FormInput
 id="item_name"
 name="item_name"
 defaultValue={item?.item_name}
 placeholder="เช่น คอมพิวเตอร์ All-in-One, เก้าอี้ทำงานพนักพิงสูง, เครื่องพิมพ์เลเซอร์..."
 dir="auto"
 required
 aria-invalid={!!state?.fieldErrors?.item_name}
 />
 <FieldError errors={state?.fieldErrors?.item_name} />
 </FormField>

 <FormField>
 <FormLabel htmlFor="category_id">หมวดหมู่</FormLabel>
 <FormCombobox
 id="category_id"
 name="category_id"
 defaultValue={item?.category?.id ?? ''}
 aria-invalid={!!state?.fieldErrors?.category_id}
 >
 <option value="">ไม่ระบุ</option>
 {categories.map((category) => (
 <option key={category.id} value={category.id}>{category.name}</option>
 ))}
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.category_id} />
 </FormField>

 <FormField>
 <FormLabel htmlFor="quantity" required>จำนวน</FormLabel>
 <FormattedNumberInput
 id="quantity"
 name="quantity"
 allowDecimals={false}
 defaultValue={item?.quantity ?? 1}
 onChange={(e) => {
 const val = parseInt(e.target.value.replace(/,/g, ''), 10)
 setCurrentQty(isNaN(val) ? 0 : val)
 }}
 required
 aria-invalid={!!state?.fieldErrors?.quantity}
 />
 <FieldError errors={state?.fieldErrors?.quantity} />
 </FormField>

 <FormField>
 <FormLabel htmlFor="unit_id" required>หน่วยนับ</FormLabel>
 <FormCombobox
 id="unit_id"
 name="unit_id"
 defaultValue={item?.unit?.id ?? ''}
 required
 aria-invalid={!!state?.fieldErrors?.unit_id}
 >
 <option value="">ไม่ระบุ</option>
 {units.map((unit) => (
 <option key={unit.id} value={unit.id}>{unit.name}</option>
 ))}
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.unit_id} />
 </FormField>
 <FormField>
 <FormLabel htmlFor="unit_price">ราคาต่อหน่วย (บาท)</FormLabel>
 <FormattedNumberInput
 id="unit_price"
 name="unit_price"
 allowDecimals={true}
 defaultValue={item?.unit_price ?? ''}
 onChange={(e) => {
 const raw = e.target.value.replace(/,/g, '')
 const val = parseFloat(raw)
 setCurrentUnitPrice(isNaN(val) ? null : val)
 }}
 aria-invalid={!!state?.fieldErrors?.unit_price}
 />
 <FieldError errors={state?.fieldErrors?.unit_price} />
 </FormField>

 {/* Live Total Value Card */}
 <div className="flex flex-col justify-end">
 <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
 <div>
 <span className="text-sm font-medium text-muted-foreground block">มูลค่ารวม</span>
 <span className="text-xs text-muted-foreground">
 {currentQty.toLocaleString('th-TH')} × {currentUnitPrice !== null ? `฿${currentUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
 </span>
 </div>
 <span className="text-base font-bold font-mono text-primary tabular-nums">
 {liveTotal !== null
 ? `฿${liveTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
 : '฿0.00'}
 </span>
 </div>
 </div>

 </FormGrid>
 </FormSection>

 {/* SECTION 2: รายละเอียดสิ่งของ */}
 <FormSection title="รายละเอียดสิ่งของ" tone="violet" icon={<Tag className="h-4 w-4" />}>
 <FormGrid className="sm:grid-cols-2">
 <TextInput
 name="asset_no"
 label={itemType === 'asset' ? 'เลขครุภัณฑ์' : 'เลขทะเบียนพัสดุ'}
 defaultValue={item?.asset_no}
 errors={state?.fieldErrors?.asset_no}
 placeholder={itemType === 'asset' ? 'เช่น 7110-001-0001/67' : 'เช่น ต.7110-001-0001/67'}
 />

 {itemType === 'asset' ? (
 <TextInput
 name="gfmis_number"
 label="เลขสินทรัพย์ (GFMIS 12 หลัก)"
 defaultValue={item?.gfmis_number}
 errors={state?.fieldErrors?.gfmis_number}
 placeholder="เช่น 100000012345"
 />
 ) : (
 <input type="hidden" name="gfmis_number" value="" />
 )}

 <FormField>
 <FormLabel htmlFor="acquired_date">วัน เดือน ปีที่รับ</FormLabel>
 <FormInput
 id="acquired_date"
 name="acquired_date"
 type="date"
 defaultValue={item?.acquired_date ? item.acquired_date.slice(0, 10) : ''}
 aria-invalid={!!state?.fieldErrors?.acquired_date}
 />
 <FieldError errors={state?.fieldErrors?.acquired_date} />
 </FormField>

 <TextInput
 name="budget_source"
 label="รับจาก (งปม.) / แหล่งเงิน"
 defaultValue={item?.budget_source}
 errors={state?.fieldErrors?.budget_source}
 placeholder="เช่น เงินงบประมาณ, เงินบำรุง, งปม.67..."
 />

 <TextInput name="brand" label="ยี่ห้อ" defaultValue={item?.brand} errors={state?.fieldErrors?.brand} placeholder="เช่น Dell, HP, Toyota..." />
 <TextInput name="model" label="รุ่น" defaultValue={item?.model} errors={state?.fieldErrors?.model} placeholder="เช่น Latitude 5420, Camry..." />
 <TextInput name="serial_no" label="Serial Number" defaultValue={item?.serial_no} errors={state?.fieldErrors?.serial_no} placeholder="เช่น CN-098XYZ..." />
 </FormGrid>
 </FormSection>

 {/* SECTION 3: สถานที่และผู้รับผิดชอบ */}
 <FormSection title="สถานที่และผู้รับผิดชอบ" tone="emerald" icon={<MapPin className="h-4 w-4" />}>
 <FormGrid className="sm:grid-cols-2">
 <FormField>
 <FormLabel htmlFor="location_id">สถานที่</FormLabel>
 <FormCombobox
 id="location_id"
 name="location_id"
 defaultValue={item?.location?.id ?? ''}
 aria-invalid={!!state?.fieldErrors?.location_id}
 >
 <option value="">ไม่ระบุ</option>
 {locations.map((location) => (
 <option key={location.id} value={location.id}>{location.name}</option>
 ))}
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.location_id} />
 </FormField>

 <FormField>
 <FormLabel htmlFor="responsible_person">ผู้รับผิดชอบ</FormLabel>
 <FormCombobox id="responsible_person" name="responsible_person" defaultValue={item?.responsible_person ?? ''} aria-invalid={!!state?.fieldErrors?.responsible_person}>
 <option value="">ไม่ระบุ</option>
 {item?.responsible_person && !responsibleUsers.some(user => user.name === item.responsible_person) && (
 <option value={item.responsible_person}>{item.responsible_person} (ข้อมูลเดิม)</option>
 )}
 {Array.from(new Map(responsibleUsers.map(user => [user.name, user])).values()).map(user => (
 <option key={user.id} value={user.name}>{user.name}</option>
 ))}
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.responsible_person} />
 </FormField>

 <FormField>
 <FormLabel htmlFor="status" required>สถานะ</FormLabel>
 <FormCombobox
 id="status"
 name="status"
 defaultValue={normalizeItemStatus(item?.status ?? 'active')}
 aria-invalid={!!state?.fieldErrors?.status}
 >
 <option value="active">ใช้งานได้</option>
 <option value="damaged">ชำรุด</option>
 <option value="inactive">เสื่อมสภาพ</option>
 </FormCombobox>
 <FieldError errors={state?.fieldErrors?.status} />
 </FormField>

 {/* Checkbox: ทรัพย์สินส่วนกลาง (เปิดให้ยืมใช้งานได้) */}
 <div className="sm:col-span-2 rounded-lg bg-muted/40 p-4">
 <label className="flex items-start gap-3 cursor-pointer select-none">
 <input
 type="checkbox"
 name="is_central"
 value="true"
 checked={isCentral}
 onChange={(event) => {
 const checked = event.target.checked
 setIsCentral(checked)
 setNote(previous => syncCentralNote(previous, checked))
 }}
 className="mt-0.5 h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer"
 />
 <div className="space-y-0.5">
 <div className="flex items-center gap-2">
 <span className="text-xs font-semibold text-foreground">
 {itemType === 'asset' ? 'ครุภัณฑ์ส่วนกลาง' : 'พัสดุส่วนกลาง'} (เปิดให้ยืมใช้งานได้)
 </span>
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30">
 กองกลาง
 </span>
 </div>
 <p className="text-sm text-muted-foreground leading-relaxed">
 บุคลากรทุกกลุ่มงานสามารถยืมรายการนี้ได้ตามระเบียบพัสดุ
 </p>
 </div>
 </label>
 </div>
 </FormGrid>
 </FormSection>

 {/* SECTION 4: รูปภาพและหมายเหตุ */}
 <FormSection title="รูปภาพและหมายเหตุ" tone="slate" icon={<ImageIcon className="h-4 w-4" />}>
 <FormGrid className="sm:grid-cols-2">
 <ImageUploadInput defaultValue={item?.image_url} />

 <FormField className="sm:col-span-2">
 <FormLabel htmlFor="note">หมายเหตุ</FormLabel>
 <FormTextarea
 id="note"
 name="note"
 aria-invalid={!!state?.fieldErrors?.note}
 value={note}
 onChange={(event) => setNote(event.target.value)}
 rows={3}
 dir="auto"
 placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)..."
 />
 <FieldError errors={state?.fieldErrors?.note} />
 </FormField>
 </FormGrid>
 </FormSection>

 {/* Depreciation or Below-threshold Regulatory notice */}
 {itemType === 'asset' ? (
 <div className="border-t border-border pt-6">
 <DepreciationFields item={item} fieldErrors={state?.fieldErrors} />
 </div>
 ) : (
 <>
 <input type="hidden" name="depreciation_enabled" value="false" />
 <input type="hidden" name="depreciation_cost" value="" />
 <input type="hidden" name="depreciation_useful_life_years" value="" />
 <input type="hidden" name="depreciation_start_basis" value="" />
 <input type="hidden" name="depreciation_start_date" value="" />
 </>
 )}

 {showActions && (
 <FormActions className={cn("mt-0 flex flex-wrap items-center justify-between gap-3 bg-card pt-5", item && "sticky bottom-0 z-10 -mx-4 border-t px-4 pb-4 sm:-mx-8 sm:px-8")}>
 {onCancel ? (
 <Button type="button" variant="outline" className="h-10 px-4 cursor-pointer" onClick={onCancel}>
 ยกเลิก
 </Button>
 ) : (
 <Button asChild variant="outline" className="h-11 px-4"><Link href="/items">ยกเลิก</Link></Button>
 )}
 <div className="flex items-center gap-2">
 {!item && (
 <Button
 type="submit"
 name="intent"
 value="save_and_another"
 variant="secondary"
 disabled={pending}
 className="h-10 px-4 font-semibold flex items-center gap-1.5 cursor-pointer"
 >
 <Plus className="h-4 w-4" />
 <span>บันทึกและเพิ่มรายการถัดไป</span>
 </Button>
 )}
 <Button type="submit" name="intent" value="save_and_close" disabled={pending} className="h-10 px-4 font-semibold flex items-center gap-1.5 cursor-pointer">
 <Save className="h-4 w-4" />
 <span>{pending ? 'กำลังบันทึก...' : item ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</span>
 </Button>
 </div>
 </FormActions>
 )}
 </form>
 )
}

const sectionTones = {
 blue: 'text-blue-700 dark:text-blue-400',
 violet: 'text-violet-700 dark:text-violet-400',
 emerald: 'text-emerald-700 dark:text-emerald-400',
 slate: 'text-muted-foreground',
}

function FormSection({ title, description, tone, icon, children }: {
 title: string
 description?: string
 tone: keyof typeof sectionTones
 icon: ReactNode
 children: ReactNode
}) {
 return (
 <section aria-label={title} className="space-y-5 border-t border-border pt-6">
 <div className="flex items-center gap-2.5">
 <span aria-hidden="true" className={sectionTones[tone]}>{icon}</span>
 <div>
 <h3 className="text-base font-semibold text-foreground">{title}</h3>
 {description && <p className="mt-0.5 text-xs opacity-80">{description}</p>}
 </div>
 </div>
 <div className="space-y-5">{children}</div>
 </section>
 )
}

function TextInput({
 name,
 label,
 defaultValue,
 errors,
 required,
 placeholder,
}: {
 name: string
 label: string
 defaultValue?: string | null
 errors?: string[]
 required?: boolean
 placeholder?: string
}) {
 return (
 <FormField>
 <FormLabel htmlFor={name} required={required}>{label}</FormLabel>
 <FormInput
 id={name}
 name={name}
 defaultValue={defaultValue ?? ''}
 placeholder={placeholder}
 dir="auto"
 aria-invalid={!!errors}
 />
 <FieldError errors={errors} />
 </FormField>
 )
}

function ImageUploadInput({ defaultValue }: { defaultValue?: string | null }) {
 const [preview, setPreview] = useState<string | null>(defaultValue || null)
 const [prevPreview, setPrevPreview] = useState<string | null>(preview)
 const [previewSrc, setPreviewSrc] = useState<string | null>(() => preview)
 const [previewFailed, setPreviewFailed] = useState<boolean>(false)
 const [removed, setRemoved] = useState<boolean>(false)
 const [uploadError, setUploadError] = useState<string | null>(null)
 const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
 const [isCropOpen, setIsCropOpen] = useState<boolean>(false)
 const fileInputRef = useRef<HTMLInputElement>(null)
 const confirmedInputRef = useRef<HTMLInputElement>(null)
 const objectUrlRef = useRef<string | null>(null)

 if (prevPreview !== preview) {
 setPrevPreview(preview)
 setPreviewSrc(preview)
 setPreviewFailed(false)
 }

 const handlePreviewError = () => {
 if (previewSrc && preview && previewSrc !== preview) {
 setPreviewSrc(preview)
 } else {
 setPreviewFailed(true)
 }
 }

 useEffect(() => {
 return () => {
 if (objectUrlRef.current) {
 URL.revokeObjectURL(objectUrlRef.current)
 }
 }
 }, [])

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (file) {
 if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
 setUploadError('กรุณาเลือกไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น')
 e.target.value = ''
 return
 }
 if (file.size > 5 * 1024 * 1024) {
 setUploadError('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB')
 e.target.value = ''
 return
 }
 const FR = typeof FileReader !== 'undefined' ? FileReader : (typeof window !== 'undefined' ? window.FileReader : null)
 if (FR) {
 const reader = new FR()
 reader.onload = () => {
 setRawImageSrc(reader.result as string)
 setIsCropOpen(true)
 }
 reader.readAsDataURL(file)
 } else if (typeof URL !== 'undefined' && URL.createObjectURL) {
 const localUrl = URL.createObjectURL(file)
 setRawImageSrc(localUrl)
 setIsCropOpen(true)
 }
 }
 }

 const handleCropConfirm = (croppedFile: File) => {
 if (confirmedInputRef.current && typeof DataTransfer !== 'undefined') {
 const dt = new DataTransfer()
 dt.items.add(croppedFile)
 confirmedInputRef.current.files = dt.files
 }

 if (objectUrlRef.current) {
 URL.revokeObjectURL(objectUrlRef.current)
 }
 const url = URL.createObjectURL(croppedFile)
 objectUrlRef.current = url
 setPreview(url)
 setRemoved(false)
 setUploadError(null)
 setIsCropOpen(false)
 setRawImageSrc(null)
 }

 const handleCropCancel = () => {
 setIsCropOpen(false)
 setRawImageSrc(null)
 if (!preview && fileInputRef.current) {
 fileInputRef.current.value = ''
 }
 }

 const handleRemove = () => {
 if (objectUrlRef.current) {
 URL.revokeObjectURL(objectUrlRef.current)
 objectUrlRef.current = null
 }
 setPreview(null)
 setRemoved(true)
 setUploadError(null)
 if (fileInputRef.current) {
 fileInputRef.current.value = ''
 }
 if (confirmedInputRef.current) confirmedInputRef.current.value = ''
 }

 return (
 <div className="space-y-2 sm:col-span-2">
 <FormLabel>รูปภาพสิ่งของ</FormLabel>

 <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 p-4 bg-slate-50 ">
 {preview ? (
 previewFailed ? (
 <div className="relative group rounded-lg overflow-hidden border border-border max-w-[240px] w-[240px] h-[180px] bg-slate-100 flex flex-col items-center justify-center p-4">
 <ImageIcon className="h-8 w-8 text-slate-400 mb-1" />
 <span className="text-xs text-slate-400 font-medium text-center">ไม่สามารถโหลดรูปภาพได้</span>
 <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="p-2 bg-white/90 hover:bg-white rounded-full text-foreground shadow-sm transition-all cursor-pointer"
 title="เปลี่ยนรูปภาพ"
 aria-label="เปลี่ยนรูปภาพ"
 >
 <Upload className="h-4 w-4" />
 </button>
 <button
 type="button"
 onClick={handleRemove}
 className="p-2 bg-rose-50 hover:bg-rose-100 rounded-full text-destructive shadow-sm transition-all cursor-pointer"
 title="ลบรูปภาพ"
 aria-label="ลบรูปภาพ"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>
 </div>
 ) : (
 <div className="relative group rounded-lg overflow-hidden border border-border max-w-[240px] max-h-[180px]">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={previewSrc || ''}
 alt="Item preview"
 loading="lazy"
 decoding="async"
 onError={handlePreviewError}
 className="object-cover w-full h-full max-w-[240px] max-h-[180px] rounded-lg"
 />
 <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="p-2 bg-white/90 hover:bg-white rounded-full text-foreground shadow-sm transition-all cursor-pointer"
 title="เปลี่ยนรูปภาพ"
 aria-label="เปลี่ยนรูปภาพ"
 >
 <Upload className="h-4 w-4" />
 </button>
 <button
 type="button"
 onClick={handleRemove}
 className="p-2 bg-rose-50 hover:bg-rose-100 rounded-full text-destructive shadow-sm transition-all cursor-pointer"
 title="ลบรูปภาพ"
 aria-label="ลบรูปภาพ"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>
 </div>
 )
 ) : (
 <div className="flex flex-wrap items-center justify-center gap-4 text-left">
 <div className="rounded-full bg-muted p-3 text-muted-foreground">
 <ImageIcon className="h-6 w-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-foreground">อัปโหลดรูปภาพ</p>
 <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG หรือ WEBP ขนาดไม่เกิน 5MB</p>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => fileInputRef.current?.click()}
 className="shrink-0"
 >
 เลือกไฟล์
 </Button>
 </div>
 )}

 <input
 ref={fileInputRef}
 id="image_file"
 type="file"
 accept="image/jpeg,image/png,image/webp"
 onChange={handleFileChange}
 className="hidden"
 />
 <input ref={confirmedInputRef} type="file" name="image_file" className="hidden" tabIndex={-1} aria-hidden="true" />

 <input
 type="hidden"
 name="remove_image"
 value={removed ? 'true' : 'false'}
 />
 <FieldError errors={uploadError ? [uploadError] : undefined} />
 </div>

 <ImageCropDialog
 isOpen={isCropOpen}
 imageSrc={rawImageSrc}
 onConfirm={handleCropConfirm}
 onCancel={handleCropCancel}
 />
 </div>
 )
}
